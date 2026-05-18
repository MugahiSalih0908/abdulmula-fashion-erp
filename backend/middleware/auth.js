// middleware/auth.js – v5 JWT + role guard

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect – verifies Bearer JWT, attaches req.user
 */
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });

    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError')
        return res.status(401).json({ success: false, message: 'Session expired.', code: 'TOKEN_EXPIRED' });
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user)
      return res.status(401).json({ success: false, message: 'Account not found.' });
    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is disabled. Contact admin.' });

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

/**
 * authorize – role-based access control
 * Usage: authorize('admin') or authorize('admin','manager')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({
      success: false,
      message: `Access denied. This action requires: ${roles.join(' or ')} role.`
    });
  next();
};

module.exports = { protect, authorize };
