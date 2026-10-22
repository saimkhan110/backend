const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/authMiddleware'); // NEW

const {
createProduct,
getAllProducts,
getProductByID,
updateProduct,
deleteProduct,
} = require('../controllers/productController');

// Read = anyone (public)
router.get('/', getAllProducts);
router.get('/:id', getProductByID);
// Write = only a logged-in admin
router.post('/', protect, authorize('admin'), upload.single('image'), createProduct);
router.put('/:id', protect, authorize('admin'), upload.single('image'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
module.exports = router;
