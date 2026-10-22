// ===== Routes for Cart (/api/cart) =====
// Cart har action ke liye login (token) zaroori hai
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getCart,
    addToCart,
    updateItem,
    removeItem,
    clearCart
} = require('../controllers/cartController');

router.post('/add', protect, addToCart);
router.get('/', protect, getCart);

// NOTE: '/clear' ko ':productId' se PEHLE rakhna zaroori hai.
// Express routes likh ke order me match karta hai - agar
// delete('/:productId') pehle hota to DELETE /api/cart/clear me
// productId = "clear" ban jata aur user ko "Invalid product ID" milta
// (cart clear hone ke bajaye 400).
router.delete('/clear', protect, clearCart);
router.put('/:productId', protect, updateItem);
router.delete('/:productId', protect, removeItem);
router.delete('/', protect, clearCart); // /clear ka alias

module.exports = router;
