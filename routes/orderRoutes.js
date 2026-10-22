// ===== Routes for Orders (/api/orders) =====
// Order user ka personal data hai - har action ke liye login zaroori
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    placeOrder,
    getMyOrders,
    getOrderById,
    cancelOrder
} = require('../controllers/orderController');

router.post('/', protect, placeOrder); // naya order place karo
router.get('/', protect, getMyOrders); // mere saare orders
router.get('/:id', protect, getOrderById); // ek order ki details
router.put('/:id/cancel', protect, cancelOrder); // order cancel karo

module.exports = router;
