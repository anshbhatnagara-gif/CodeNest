import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please login.' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Please login again.' });
  }

  try {
    // Fetch fresh user from DB
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, token_version, xp, level, last_active_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    // Reject tokens missing token_version claim, invalid type, or with mismatched version
    if (
      decoded.token_version === undefined ||
      typeof decoded.token_version !== 'number' ||
      decoded.token_version !== user.token_version
    ) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked or expired. Please login again.'
      });
    }

    req.user = user;

    // Update last_active_at silently
    await pool.execute(
      'UPDATE users SET last_active_at = NOW() WHERE id = ?',
      [decoded.id]
    );

    next();
  } catch (err) {
    console.error('Auth Database Error:', err.message);
    return res.status(500).json({ success: false, message: 'Database error during authentication.' });
  }
};

/**
 * Optional authentication middleware for public endpoints (e.g. course browsing).
 * - If no Authorization header or non-Bearer format: proceeds as unauthenticated guest (req.user = undefined).
 * - If token is expired, malformed, invalid, or revoked: degrades gracefully to unauthenticated guest (req.user = undefined).
 * - If token is valid: populates req.user with verified user record.
 * - If database execution fails: returns HTTP 500 (does not mask server/database outages).
 * - Omits last_active_at write overhead on public read requests.
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.user = undefined;
    return next();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    // Expired, malformed, wrong algorithm, or invalid signature: degrade to guest
    req.user = undefined;
    return next();
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, token_version, xp, level, last_active_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      req.user = undefined;
      return next();
    }

    const user = rows[0];

    // Check token_version against current user state in database
    if (
      decoded.token_version === undefined ||
      typeof decoded.token_version !== 'number' ||
      decoded.token_version !== user.token_version
    ) {
      req.user = undefined;
      return next();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Optional Auth Database Error:', err.message);
    return res.status(500).json({ success: false, message: 'Database error during authentication.' });
  }
};

export default authMiddleware;
