// Security middleware (Track 0 Foundation, consumed by Track 1).
// Exports rate limiters and auth/role guards built on express-rate-limit.

const rateLimit = require('express-rate-limit');
const config = require('../../config/config');

// General API limiter.
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// Stricter limiter for auth endpoints (brute-force protection).
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' }
});

// Express guard requiring an authenticated session.
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

// Express guard requiring one of the given roles on the session user.
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.session && req.session.user && req.session.user.role;
    if (role && roles.includes(role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { apiLimiter, authLimiter, requireAuth, requireRole };
