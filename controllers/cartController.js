// ===== Cart Controller =====
// Cart ke saare APIs: GET (fetch), ADD, UPDATE, REMOVE, CLEAR
const mongoose = require('mongoose');
const Cart = require('../models/cartModel');
const Product = require('../models/ProductModel');

// ---------- Helpers ----------

// Cart ka total price dobara calculate karo
// Ek hi jagah price ka logic - add/update/remove/clear sab yahi use karte hain
const calcTotal = (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Cart ke items me product ka LIVE data attach karo
// populate se bare ObjectId ki jagah poora product document aa jaata hai
const withProducts = (cart) =>
    cart.populate('items.product', 'name price image isActive stock');

// Cart me product dhoondo
// Pehle `productId` snapshot se match karo (naye carts), phir `product` ref se
// (purane carts jahan snapshot nahi tha)
const matchItem = (i, productId) =>
    i.productId === productId.toString() ||
    (!i.productId && i.product && i.product.toString() === productId.toString());

// User ka cart nikalo - nahi hai to ek khaali cart bana do
// NOTE: unique index ki wajah se 2 requests ek saath aa sakti hain,
//       dono "create" karein to ek ko E11000 milega - us case me dobara read kar lo
const getOrCreateCart = async (userId) => {
    const existing = await Cart.findOne({ user: userId });
    if (existing) return existing;

    try {
        return await Cart.create({ user: userId, items: [], totalPrice: 0 });
    } catch (error) {
        // Duplicate key = kisi aur ne abhi bana diya -> use wala cart lao
        if (error.code === 11000) return Cart.findOne({ user: userId });
        throw error;
    }
};

// ---------- 1) GET CART ----------
// GET /api/cart
const getCart = async (req, res) => {
    try {
        // User ne abhi tak cart nahi banaya -> khaali cart bana do
        const cart = await getOrCreateCart(req.user._id);

        await withProducts(cart);

        res.json({
            success: true,
            message: 'Cart fetched successfully',
            cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cart',
            error: error.message
        });
    }
};

// ---------- 2) ADD TO CART ----------
// POST /api/cart/add   body: { productId, quantity }
const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // (a) productId zaroori hai
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        // (b) Quantity valid hai? (default 1)
        // NOTE: 'quantity || 1' likhne se 0 bhi 1 ban jata tha (0 falsy hai).
        // Isliye undefined/null/'' ko hi default maano, 0 ko validate karo.
        const qty =
            quantity === undefined || quantity === null || quantity === ''
                ? 1
                : Number(quantity);

        if (!Number.isInteger(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive whole number'
            });
        }

        // (c) Product ID sahi format me hai?
        // Ye check Product.findById() se PEHLE hona chahiye - warna Mongoose
        // CastError deke 500 chala jaayega, 400 ki jagah
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        // (d) Product exist karta hai?
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // (e) Product active hai? (admin ne deactivate to nahi kiya)
        if (!product.isActive) {
            return res.status(400).json({
                success: false,
                message: 'This product is currently unavailable'
            });
        }

        // (f) User ka cart nikalo (nahi hai to bana do)
        const cart = await getOrCreateCart(req.user._id);

        // (g) Ye product pehle se cart me hai?
        const item = cart.items.find((i) => matchItem(i, productId));

        // Naya total quantity (purani + nayi)
        const newQty = (item ? item.quantity : 0) + qty;

        // (h) Stock check - stock = null ka matlab "unlimited" (check skip)
        if (product.stock !== null && product.stock !== undefined && newQty > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} item(s) left in stock`
            });
        }

        // (i) Item pehle se hai -> quantity aur snapshot refresh karo
        // naya item -> items array me push karo
        if (item) {
            item.quantity = newQty;
            item.price = product.price; // price change hua to yahin update
            item.name = product.name;
            item.image = product.image;
        } else {
            cart.items.push({
                product: product._id,
                productId: product._id.toString(), // snapshot
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: qty
            });
        }

        // (j) Total dobara calculate karo
        cart.totalPrice = calcTotal(cart.items);

        // (k) Purane items me productId snapshot missing hai to bhar do
        cart.items.forEach((it) => {
            if (!it.productId && it.product) it.productId = it.product.toString();
        });

        // (l) DB me save karo
        await cart.save();
        await withProducts(cart);

        res.status(200).json({
            success: true,
            message: 'Added to cart successfully',
            cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to add item to cart',
            error: error.message
        });
    }
};

// ---------- 3) UPDATE ITEM ----------
// PUT /api/cart/:productId   body: { quantity }
const updateItem = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        // (a) Product ID valid format me hai?
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        // (b) Quantity valid?
        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive whole number'
            });
        }

        // (c) Cart aur item dhoondo
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const index = cart.items.findIndex((i) => matchItem(i, productId));
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        const item = cart.items[index];

        // (d) Stock check (agar product abhi bhi exist karta hai)
        const product = await Product.findById(item.productId || item.product);
        if (product && product.stock !== null && product.stock !== undefined && qty > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} item(s) left in stock`
            });
        }

        // (e) Quantity SET karo (add nahi - replace)
        item.quantity = qty;

        // (f) Total update
        cart.totalPrice = calcTotal(cart.items);

        await cart.save();
        await withProducts(cart);

        res.json({
            success: true,
            message: 'Cart updated successfully',
            cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update cart item',
            error: error.message
        });
    }
};

// ---------- 4) REMOVE ITEM ----------
// DELETE /api/cart/:productId
const removeItem = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Item ko hata do
        const index = cart.items.findIndex((i) => matchItem(i, productId));

        // Kuch hata hi nahi -> matlab item cart me tha hi nahi
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }

        cart.items.splice(index, 1);
        cart.totalPrice = calcTotal(cart.items);

        await cart.save();
        await withProducts(cart);

        res.json({
            success: true,
            message: 'Item removed from cart successfully',
            cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to remove item from cart',
            error: error.message
        });
    }
};

// ---------- 5) CLEAR CART ----------
// DELETE /api/cart/clear   (ya DELETE /api/cart)
const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Items hatao, total 0 karo
        cart.items = [];
        cart.totalPrice = 0;

        await cart.save();

        res.json({
            success: true,
            message: 'Cart cleared successfully',
            cart
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to clear cart',
            error: error.message
        });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateItem,
    removeItem,
    clearCart
};
