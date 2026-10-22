// ===== Order Model (orders collection) =====
// Order = cart ka PERMANENT copy. Cart mutable hai, order immutable.
// Cart item ki tarah yahan bhi 'product' (live link) + 'productId' (snapshot)
// dono rakhte hain, taake admin product delete bhi de to order history intact rahe.
const mongoose = require('mongoose');

// Order ke andar ek item ka structure
const OrderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        productId: {
            type: String,
            required: true
        },
        // ---- Snapshot fields (order ke time ki price/name/image) ----
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
            min: 1
        }
    },
    { _id: false } // har item ka apna _id nahi chahiye
);

// Delivery address ka sub-schema
const ShippingAddressSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true
        },
        address: {
            type: String,
            required: [true, 'Address is required'],
            trim: true
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        postalCode: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { _id: false }
);

const OrderSchema = new mongoose.Schema(
    {
        // Human readable order number (user ko dikhta hai)
        // Example: ORD-20260121-8F3K2A
        orderNumber: {
            type: String,
            required: true,
            unique: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true // 'my orders' query fast rahega
        },
        items: {
            type: [OrderItemSchema],
            default: []
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0
        },
        shippingAddress: {
            type: ShippingAddressSchema,
            required: true
        },
        paymentMethod: {
            type: String,
            enum: ['COD', 'Card'], // COD = Cash on Delivery
            default: 'COD'
        },
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Paid'],
            default: 'Pending'
        },
        status: {
            type: String,
            enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
            default: 'Confirmed'
        }
    },
    {
        timestamps: true // createdAt / updatedAt apne aap
    }
);

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
