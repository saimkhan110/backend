// ===== Order Controller =====
// Order ke saare APIs: PLACE, MY ORDERS, ORDER DETAIL, CANCEL
const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/ProductModel');
const { sendOrderConfirmationEmail, sendOrderStatusEmail, isEmailConfigured } = require('../services/emailService');

// ---------- Helpers ----------

// Unique order number banao
// Format: ORD-<YYYYMMDD>-<6 random chars>
// Example: ORD-20260121-8F3K2A
// yyyyMMdd sortable by date hai, 6 random chars unique banata hai
const generateOrderNumber = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ORD-${y}${m}${d}-${rand}`;
};

// Order ke items me LIVE product data attach karo
const withProducts = (order) =>
    order.populate('items.product', 'name price image stock isActive');

// Order create karo - orderNumber collide ho jaye to dobara try
// (schema pe unique index hai, DB duplicate insert ko reject kar dega)
const createOrder = async (payload) => {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await Order.create({ ...payload, orderNumber: generateOrderNumber() });
        } catch (error) {
            // Sirf orderNumber ka duplicate ho to retry karo, baaki errors seedhe throw
            if (error.code === 11000 && error.keyPattern && error.keyPattern.orderNumber) {
                continue;
            }
            throw error;
        }
    }
    throw new Error('Could not generate a unique order number');
};

// ---------- 1) PLACE ORDER ----------
// POST /api/orders   body: { shippingAddress, paymentMethod }
const placeOrder = async (req, res) => {
    try {
        const { shippingAddress, paymentMethod } = req.body;

        // (a) Shipping address validate - chaaron fields chahiye
        if (
            !shippingAddress ||
            !shippingAddress.fullName ||
            !shippingAddress.phone ||
            !shippingAddress.address ||
            !shippingAddress.city
        ) {
            return res.status(400).json({
                success: false,
                message: 'Complete shipping address is required'
            });
        }

        // (b) Payment method validate - sirf COD aur Card
        const method = paymentMethod || 'COD';
        if (!['COD', 'Card'].includes(method)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment method'
            });
        }

        // (c) User ka cart load karo - khaali cart matlab kuch order karne ko hai nahi
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty'
            });
        }

        // (d) HAR item ka stock pehle check karo - kuch bhi bana hi nahi
        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Product "${item.name}" is no longer available`
                });
            }
            if (!product.isActive) {
                return res.status(400).json({
                    success: false,
                    message: `Product "${item.name}" is no longer available`
                });
            }
            // stock null = unlimited -> skip
            if (product.stock !== null && product.stock !== undefined && product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock} item(s) left in stock for "${item.name}"`
                });
            }
        }

        // (e) Order banao - cart items ka snapshot copy
        const order = await createOrder({
            user: req.user._id,
            items: cart.items.map((item) => ({
                product: item.product,
                productId: item.productId,
                name: item.name,
                price: item.price,
                image: item.image,
                quantity: item.quantity
            })),
            totalPrice: cart.totalPrice,
            // Address field-by-field rebuild kiya hai, taake malicious client
            // order document me extra keys inject na kar sake
            shippingAddress: {
                fullName: shippingAddress.fullName,
                phone: shippingAddress.phone,
                address: shippingAddress.address,
                city: shippingAddress.city,
                postalCode: shippingAddress.postalCode || ''
            },
            paymentMethod: method,
            // Card pe payment ho gayi, COD me paisa delivery pe milega
            paymentStatus: method === 'Card' ? 'Paid' : 'Pending',
            status: 'Confirmed'
        });

        // (f) Stock decrement - ATOMIC
        // findOneAndUpdate({ stock: { $gte: qty } }, { $inc: { stock: -qty } })
        // do users ek saath same product le sakein to dono me se sirf ek hi
        // stock kam kar payega (bina ise oversell ho jayega)
        const decremented = [];
        for (const item of order.items) {
            const product = await Product.findById(item.productId);
            // stock null (unlimited) me se minus nahi karna
            if (!product || product.stock === null || product.stock === undefined) {
                continue;
            }

            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (!updated) {
                // Beech me stock khatam ho gaya - jo minus hua tha wapas add karo
                for (const d of decremented) {
                    await Product.updateOne({ _id: d.productId }, { $inc: { stock: d.quantity } });
                }
                // Adhoora order mat chhod - delete kar do
                await Order.deleteOne({ _id: order._id });

                const fresh = await Product.findById(item.productId);
                const left = fresh ? fresh.stock : 0;
                return res.status(400).json({
                    success: false,
                    message: `Only ${left} item(s) left in stock for "${item.name}"`
                });
            }

            decremented.push({ productId: item.productId, quantity: item.quantity });
        }

        // (g) Cart khaali karo - order ban chuka hai to cart me kuch nahi rehna chahiye
        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();

        // (h) Order confirmation email - BACKGROUND me bhejo
        // Email fail ho jaye (SMTP down / galat password) to order fail NAHI hona chahiye.
        // Status order document me save hota hai taake DB se verify ho sake.
        if (isEmailConfigured()) {
            sendOrderConfirmationEmail({
                order,
                customerEmail: req.user.email,
                customerName: req.user.name
            })
                .then((result) =>
                    Order.updateOne(
                        { _id: order._id },
                        result.success
                            ? { emailStatus: 'Sent', emailSentAt: new Date() }
                            : { emailStatus: 'Failed', emailError: result.error || 'Unknown error' }
                    )
                )
                .catch((error) =>
                    Order.updateOne(
                        { _id: order._id },
                        { emailStatus: 'Failed', emailError: error.message }
                    )
                )
                // DB hiccup ho to bhi background email kabhi server crash na kare
                .catch(() => {});
        }

        // (i) 201 Created + order
        await withProducts(order);

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            // Email background me ja raha hai - SMTP creds na hon to 'Not configured'
            confirmationEmail: isEmailConfigured() ? 'Queued' : 'Not configured',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to place order',
            error: error.message
        });
    }
};

// ---------- 2) GET MY ORDERS ----------
// GET /api/orders - order history list
const getMyOrders = async (req, res) => {
    try {
        // user scope lagane se user sirf APNE hi orders dekh sakta hai
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

        // Har order ka live product data parallel me attach karo
        await Promise.all(orders.map((o) => withProducts(o)));

        res.json({
            success: true,
            message: 'Orders fetched successfully',
            count: orders.length,
            orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
            error: error.message
        });
    }
};

// ---------- 3) GET SINGLE ORDER ----------
// GET /api/orders/:id - detail view
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        // NOTE: filter me `user` zaroori hai - sirf `findById(id)` hota to
        // koi bhi logged-in user URL me id badal ke doosre ka order padh sakta tha (IDOR)
        const order = await Order.findOne({ _id: id, user: req.user._id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        await withProducts(order);

        res.json({
            success: true,
            message: 'Order fetched successfully',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
            error: error.message
        });
    }
};

// ---------- 4) CANCEL ORDER ----------
// PUT /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findOne({ _id: id, user: req.user._id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Sirf Pending/Confirmed order cancel ho sakta hai
        // Ye check stock loop se PEHLE hai - isse "cancel dobara" case me
        // stock dobara restore nahi hoga
        if (order.status !== 'Pending' && order.status !== 'Confirmed') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled when status is "${order.status}"`
            });
        }

        order.status = 'Cancelled';

        // Stock wapas add karo - order bana tha tab stock minus hua tha,
        // cancel hua to wapas jaana chahiye warna inventory "lose" hoti rahegi
        for (const item of order.items) {
            const product = await Product.findById(item.productId);
            if (product && product.stock !== null && product.stock !== undefined) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: item.quantity } }
                );
            }
        }

        await order.save();
        await withProducts(order);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order',
            error: error.message
        });
    }
};

// ---------- 5) ADMIN: GET ALL ORDERS ----------
// GET /api/orders/admin/all
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        await Promise.all(orders.map((o) => withProducts(o)));

        res.json({
            success: true,
            message: 'All orders fetched successfully',
            count: orders.length,
            orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch all orders',
            error: error.message
        });
    }
};

// ---------- 6) ADMIN: UPDATE ORDER STATUS ----------
// PUT /api/orders/admin/:id/status   body: { status }
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const allowed = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order status'
            });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Purana status yaad rakho - dobara same status save karne par
        // customer ko duplicate email nahi jani chahiye
        const previousStatus = order.status;

        order.status = status;
        await order.save();
        await order.populate('user', 'name email');
        await withProducts(order);

        // Status badla to customer ko update email (Shipped / Delivered / Cancelled)
        // Background me - email fail ho jaye to status update fail nahi hota.
        const statusEmailStatuses = ['Shipped', 'Delivered', 'Cancelled'];
        const shouldSendStatusEmail =
            status !== previousStatus &&
            statusEmailStatuses.includes(status) &&
            isEmailConfigured() &&
            Boolean(order.user?.email);

        if (shouldSendStatusEmail) {
            sendOrderStatusEmail({
                order,
                customerEmail: order.user.email,
                customerName: order.user.name
            })
                .then((result) =>
                    Order.updateOne(
                        { _id: order._id },
                        result.success
                            ? { statusEmailStatus: 'Sent', statusEmailSentAt: new Date() }
                            : { statusEmailStatus: 'Failed', statusEmailError: result.error || 'Unknown error' }
                    )
                )
                .catch((error) =>
                    Order.updateOne(
                        { _id: order._id },
                        { statusEmailStatus: 'Failed', statusEmailError: error.message }
                    )
                )
                .catch(() => {});
        }

        res.json({
            success: true,
            message: 'Order status updated successfully',
            statusEmail:
                shouldSendStatusEmail ? 'Queued' : status === previousStatus ? 'Not sent (status unchanged)' : 'Not sent',
            order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
};

module.exports = {
    placeOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    getAllOrders,
    updateOrderStatus
};
