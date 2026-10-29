import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10); // Default: 15 minutes
const maxRequests = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10); // Default: 10 requests per window

export const createRateLimiter = (customOptions = {}) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.'
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
    ...customOptions
  });
};

// Default rate limiter instance for auth endpoints
export const authRateLimiter = createRateLimiter();

export default authRateLimiter;
