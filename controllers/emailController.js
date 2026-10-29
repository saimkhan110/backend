// ===== Email Controller =====
// Manual/admin email trigger. Asli automatic email order place hote hi
// orderController se jati hai - ye endpoint testing aur re-send ke liye hai.

const Order = require('../models/orderModel');
const {
    sendEmail,
    sendOrderConfirmationEmail,
    sendOrderStatusEmail,
    orderConfirmationTemplate,
    orderConfirmationText,
    getEmailAttachments
} = require('../services/emailService');

// POST /api/email/order-confirmation   (admin only)
// Body: { orderId }  -> asli order ka email dobara bhejne ke liye
//   ya: { to, orderNumber, customerName, items, total, shippingAddress, paymentMethod }
const sendOrderConfirmation = async (req, res) => {
    try {
        const { orderId, to, orderNumber, customerName, items, total, shippingAddress, paymentMethod } = req.body;

        // ---- Mode 1: real order se re-send ----
        if (orderId) {
            const order = await Order.findById(orderId).populate('user', 'name email');
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const result = await sendOrderConfirmationEmail({
                order,
                customerEmail: order.user?.email,
                customerName: order.user?.name || order.shippingAddress?.fullName
            });

            await Order.updateOne(
                { _id: order._id },
                result.success
                    ? { emailStatus: 'Sent', emailSentAt: new Date(), emailError: null }
                    : { emailStatus: 'Failed', emailError: result.error || 'Unknown error' }
            );

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send email',
                    error: result.error
                });
            }

            return res.json({
                success: true,
                message: 'Order confirmation email sent',
                messageId: result.messageId
            });
        }

        // ---- Mode 2: manual payload (testing) ----
        if (!to || !orderNumber) {
            return res.status(400).json({
                success: false,
                message: 'orderId, or both email (to) and orderNumber are required'
            });
        }

        const html = orderConfirmationTemplate({
            orderNumber,
            customerName: customerName || 'Customer',
            customerEmail: to,
            items: items || [],
            total: total || 0,
            shippingAddress: shippingAddress || {},
            paymentMethod: paymentMethod || 'COD'
        });

        const result = await sendEmail({
            to,
            subject: `Order Confirmed · ${orderNumber}`,
            html,
            text: orderConfirmationText({
                orderNumber,
                customerName,
                items,
                total,
                shippingAddress,
                paymentMethod
            }),
            attachments: getEmailAttachments()
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send email',
                error: result.error
            });
        }

        res.json({
            success: true,
            message: 'Order confirmation email sent',
            messageId: result.messageId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Email controller error',
            error: error.message
        });
    }
};

// POST /api/email/order-status   (admin only)
// Body: { orderId }  -> current status (Shipped/Delivered/Cancelled) ka email dobara bhejo
// Un orders ke liye useful hai jo fix se pehle deliver ho chuke the.
const sendOrderStatusUpdate = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'orderId is required'
            });
        }

        const order = await Order.findById(orderId).populate('user', 'name email');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!['Shipped', 'Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `No status email is sent for status "${order.status}"`
            });
        }

        const result = await sendOrderStatusEmail({
            order,
            customerEmail: order.user?.email,
            customerName: order.user?.name || order.shippingAddress?.fullName
        });

        await Order.updateOne(
            { _id: order._id },
            result.success
                ? { statusEmailStatus: 'Sent', statusEmailSentAt: new Date(), statusEmailError: null }
                : { statusEmailStatus: 'Failed', statusEmailError: result.error || 'Unknown error' }
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send status email',
                error: result.error
            });
        }

        res.json({
            success: true,
            message: `Status email sent (${order.status})`,
            messageId: result.messageId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Email controller error',
            error: error.message
        });
    }
};

module.exports = { sendOrderConfirmation, sendOrderStatusUpdate };
