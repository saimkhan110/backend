// STEP 6: Two middlewares
// Authentication = "Who are you?" -> verifies the token (protect)
// Authorization = "Are you allowed?" -> checks the role (authorize)
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
// ---------- 6.1 protect: lets only valid token holders pass ----------
const protect = async (req, res, next) => {
try {
let token;
// (a) Check the header: Authorization: Bearer TOKEN
const authHeader = req.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer')) {
// split "Bearer eyJhbG..." and keep only the token
token = authHeader.split(' ')[1];
}
// (b) No token -> 401
if (!token) {
return res.status(401).json({
success: false,
message: 'Not authorized, no token provided'
});
}
// (c) Verify: signature match + expiry check
// A wrong secret or an expired token fails here
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// (d) Load the user from DB using the id inside the token
req.user = await User.findById(decoded.id);
if (!req.user) {
return res.status(401).json({
success: false,
message: 'User no longer exists'
});
}
// (e) Everything is fine -> continue to the next handler
next();
} catch (error) {
// TokenExpiredError / JsonWebTokenError arrive here
return res.status(401).json({
success: false,
message: 'Not authorized, token failed',
error: error.message
});
}
};
// ---------- 6.2 authorize: checks whether the role is allowed ----------
// Usage: authorize('admin') or authorize('admin', 'superadmin')
const authorize = (...roles) => {
return (req, res, next) => {
// req.user only exists after protect, so protect must run first
if (!roles.includes(req.user.role)) {
return res.status(403).json({
success: false,
message: `Role '${req.user.role}' is not allowed to access this resource`
});
}
next(); // role is allowed -> continue
};
};
module.exports = { protect, authorize };