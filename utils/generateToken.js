// STEP 4: Helper that generates a JWT token
const jwt = require('jsonwebtoken');
const generateToken = (userId, role) => {
// payload = data stored inside the token (id and role)
// signature = created with JWT_SECRET so nobody can tamper with the token
return jwt.sign(
{ id: userId, role: role },
process.env.JWT_SECRET,
{ expiresIn: process.env.JWT_EXPIRES_IN || '7d' } // token expires after 7 days
);
};
module.exports = generateToken;
