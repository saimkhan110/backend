const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, default: '', trim: true },
    category: {
    type: String,
    required: [true, "Product category is required"],
    trim: true
},
    price: { type: Number, required: [true, 'Product price is required'], min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
