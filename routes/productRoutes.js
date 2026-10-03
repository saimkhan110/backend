const express = require('express');
const mongoose = require('mongoose');
const upload = require('../middleware/productUpload');
const { createProduct, getAllProducts, getProductByID, updateProduct, deleteProduct } = require('../controllers/productController');
const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    next();
});

router.post('/', upload.single('image'), createProduct);
router.get('/', getAllProducts);
router.get('/:id', getProductByID);
router.put('/:id', upload.single('image'), updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;

