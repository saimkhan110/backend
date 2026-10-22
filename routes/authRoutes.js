// STEP 7: Routes for Users / Auth
const express = require('express');
const router = express.Router();
const {
register,
login,
getMe,
changePassword,
getAllUsers
} = require('../controllers/authController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes - anyone can call them without a token
router.post('/register', register);
router.post('/login', login);

// Protected routes - a valid token is required
router.get('/me', protect, getMe);

router.put('/change-password', protect, changePassword);
// Admin only - protect first, then authorize
router.get('/', protect, authorize('admin'), getAllUsers);
module.exports = router;
