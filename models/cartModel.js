// ===== Cart Model (carts collection) =====
// Ek user ka sirf EK cart hota hai - isliye `user` field pe unique index hai.
// items[] me har line ke saath:
//   - `product`   -> LIVE reference (checkout pe stock kam karne ke liye)
//   - `productId` -> STRING snapshot (product delete ho jaye tab bhi item render/removable rahe)
const mongoose = require('mongoose');

// Cart item ka structure
const CartItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        // Product ki ID ka snapshot (string me) - admin ne product delete kar diya
        // ho tab bhi frontend ko item ki ID mil jaati hai
        productId: {
            type: String,
            required: true
        },
        // ---- Snapshot fields (add karte waqt copy ho jaate hain) ----
        // Fayda: admin ne price change ki ya product delete kiya,
        // tab bhi cart me item ki sahi info dikhti rahegi
        name: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        image: {
            type: String,
            default: 'null'
        },
        quantity: {
            type: Number,
            required: true,
            min: 1, // quantity kabhi 0 ya negative nahi ho sakti
            default: 1
        }
    },
    { _id: false } // har item ka apna _id nahi chahiye
);

const CartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true // 1 user = sirf 1 cart
        },
        items: {
            type: [CartItemSchema],
            default: []
        },
        totalPrice: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true // createdAt / updatedAt apne aap
    }
);

const Cart = mongoose.model('Cart', CartSchema);
module.exports = Cart;
