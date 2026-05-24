// middleware/invitationLimiter.js – Rate limiting for invitation endpoints

const rateLimit = require('express-rate-limit');

// ── Limit invitation creation (10 per hour per IP) ────────────────
const createInvitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many invitations created. Maximum 10 per hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to /api/invitations/create
    return !req.path.includes('/create');
  }
});

// ── Limit token validation (100 per hour per IP) ──────────────────
const validateTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    success: false,
    message: 'Too many validation attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to /api/invitations/validate or /api/invitations/accept
    return !(req.path.includes('/validate') || req.path.includes('/accept'));
  }
});

// ── Stricter limits for accepting invitations (5 attempts per 30 min)
const acceptInvitationLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5,
  message: {
    success: false,
    message: 'Too many attempts to accept invitation. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to /api/invitations/accept
    return !req.path.includes('/accept');
  }
});

module.exports = {
  createInvitationLimiter,
  validateTokenLimiter,
  acceptInvitationLimiter
};
