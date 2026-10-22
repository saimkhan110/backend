// STEP 5: Logic for all auth APIs
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
// ---------- 5.1 REGISTER: create a new user ----------
// POST /api/users/register
const register = async (req, res) => {
try {
const { name, email, password } = req.body;
// (a) Basic validation, written in the style of this codebase
if (!name || !email || !password) {
return res.status(400).json({
success: false,
message: 'Name, email and password are required'
});
}
// (b) Check whether this email is already registered
const userExists = await User.findOne({ email });
if (userExists) {
return res.status(400).json({
success: false,
message: 'User already exists with this email'
});
}
// (c) Create the user
// The password is sent plain - the pre('save') hook hashes it.
// Security: role is always 'user', otherwise anyone could make themselves admin.
const user = await User.create({
name,
email,
password,
role: 'user'
});
// (d) Generate a token for the new user
const token = generateToken(user._id, user.role);
// (e) Response - never send the password back
res.status(201).json({
success: true,
message: 'User registered successfully',
token,
user: {
id: user._id,
name: user.name,
email: user.email,
role: user.role
}
});
} catch (error) {
res.status(400).json({
success: false,
message: 'User registration failed',
error: error.message
});
}
};
// ---------- 5.2 LOGIN: sign in an existing user ----------
// POST /api/users/login
const login = async (req, res) => {
try {
const { email, password } = req.body;
// (a) Validation
if (!email || !password) {
return res.status(400).json({
success: false,
message: 'Email and password are required'
});
}
// (b) Find the user
// The password field has 'select: false', so +password is required here
const user = await User.findOne({ email }).select('+password');
// (c) Wrong email or wrong password -> SAME message so attackers get no hint
if (!user || !(await user.comparePassword(password))) {
return res.status(401).json({
success: false,
message: 'Invalid email or password'
});
}
// (d) Blocked users must not be able to log in
if (!user.isActive) {
return res.status(403).json({
success: false,
message: 'Your account is deactivated. Contact admin.'
});
}
// (e) Create the token and send it back
const token = generateToken(user._id, user.role);
res.json({
success: true,
message: 'Login successful',
token,
user: {
id: user._id,
name: user.name,
email: user.email,
role: user.role
}
});
} catch (error) {
res.status(500).json({
success: false,
message: 'Login failed',
error: error.message
});
}
};
// ---------- 5.3 GET ME: profile of the logged-in user ----------
// GET /api/users/me (protected - token required)
const getMe = async (req, res) => {
try {
// req.user was already loaded by the protect middleware
res.json({
success: true,
user: req.user
});
} catch (error) {
res.status(500).json({
success: false,
message: 'Failed to fetch profile',
error: error.message
});
}
};
// ---------- 5.4 CHANGE PASSWORD ----------
// PUT /api/users/change-password (protected)
const changePassword = async (req, res) => {
try {
const { currentPassword, newPassword } = req.body;
if (!currentPassword || !newPassword) {
return res.status(400).json({
success: false,
message: 'Current password and new password are required'
});
}
// password field has select:false, so load it with +password
const user = await User.findById(req.user._id).select('+password');
// Verify the old password first
if (!(await user.comparePassword(currentPassword))) {
return res.status(401).json({
success: false,
message: 'Current password is incorrect'
});
}
// Set the new value -> call save() so the pre('save') hook hashes it
user.password = newPassword;
await user.save(); // NOTE: findByIdAndUpdate does NOT run this hook
res.json({
success: true,
message: 'Password changed successfully'
});
} catch (error) {
res.status(500).json({
success: false,
message: 'Failed to change password',
error: error.message
});
}
};
// ---------- 5.5 GET ALL USERS (admin only) ----------
// GET /api/users (protected + authorize('admin'))
const getAllUsers = async (req, res) => {
try {
const users = await User.find().sort({ createdAt: -1 });
res.json({
success: true,
total: users.length,
data: users
});
} catch (error) {
res.status(500).json({
success: false,
message: 'Failed to fetch users',
error: error.message
});
}
};
module.exports = {
register,
login,
getMe,
changePassword,
getAllUsers
};