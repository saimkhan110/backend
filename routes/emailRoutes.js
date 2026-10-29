// ===== Email Routes =====
const express = require('express');
const router = express.Router();
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../controllers/emailController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/email/order-confirmation
// Manual/re-send trigger - sirf admin, warna ye endpoint open email relay ban jata
// (koi bhi kisi ko arbitrary email bhej sakta tha).
router.post('/order-confirmation', protect, authorize('admin'), sendOrderConfirmation);

// POST /api/email/order-status
// Body: { orderId } -> us order ka current status email dobara bhejo
router.post('/order-status', protect, authorize('admin'), sendOrderStatusUpdate);

module.exports = router;
