const Product = require('../models/ProductModel');
const Category = require('../models/categoryModel');
const { deleteFile } = require('../utils/fileHelper');

async function checkCategory(name) {
    if (typeof name !== 'string' || !await Category.exists({ name: name.trim() })) {
        const error = new Error('Please select an available category');
        error.status = 400;
        throw error;
    }
}

// Create a product with an optional image.
const createProduct = async (req, res, next) => {
    try {
        const { name, category, price, description, stock, isActive } = req.body;
        await checkCategory(category);
        let image = null;
        if (req.file) {
            image = 'uploads/' + req.file.filename;
        }
        const product = await Product.create({
            name, category, price, description, stock, isActive, image
        });
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        next(error);
    }
};

// Read all products.
const getAllProducts = async (req, res, next) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, total: products.length, data: products });
    } catch (error) {
        next(error);
    }
};

// Read one product.
const getProductByID = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

// Update details and optionally replace the image.
const updateProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            if (req.file) deleteFile(req.file.filename);
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const { name, category, price, description, stock, isActive } = req.body;
        if (category !== undefined) await checkCategory(category);
        const oldImage = product.image;
        product.name = name ?? product.name;
        product.category = category ?? product.category;
        product.price = price ?? product.price;
        product.description = description ?? product.description;
        product.stock = stock ?? product.stock;
        product.isActive = isActive ?? product.isActive;
        if (req.file) {
            product.image = 'uploads/' + req.file.filename;
        }
        await product.save();
        // Keep the old image if validation or the database update fails.
        if (req.file) {
            req.file = null;
            deleteFile(oldImage);
        }
        res.json({ success: true, message: 'Product updated successfully', product });
    } catch (error) {
        next(error);
    }
};

// Delete the record and its image.
const deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        deleteFile(product.image);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = { createProduct, getAllProducts, getProductByID, updateProduct, deleteProduct };
