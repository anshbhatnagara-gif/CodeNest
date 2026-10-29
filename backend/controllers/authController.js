import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      token_version: user.token_version ?? 1
    },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' }
  );
};

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request body.' });
    }

    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Name, email, and password must be strings.' });
    }

    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: 'Phone must be a string.' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Name is required and cannot be empty or whitespace only.' });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: 'Name must not exceed 100 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required and cannot be empty or whitespace only.' });
    }

    if (normalizedEmail.length > 150) {
      return res.status(400).json({ success: false, message: 'Email must not exceed 150 characters.' });
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const safePhone = typeof phone === 'string' ? phone.trim() : '';
    if (safePhone.length > 20) {
      return res.status(400).json({ success: false, message: 'Phone number must not exceed 20 characters.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must not exceed 128 characters.' });
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'Password cannot exceed 72 bytes in UTF-8 encoding.' });
    }

    // Check if user exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Public registration ALWAYS assigns the 'student' role.
    // Role promotion to 'owner' is strictly restricted to administrative CLI provisioning.
    const role = 'student';

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, phone, password, role, token_version, last_active_at) VALUES (?, ?, ?, ?, ?, 1, NOW())',
      [trimmedName, normalizedEmail, safePhone, hashedPassword, role]
    );

    const userId = result.insertId;

    // Log activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, 'Account registered']
    );

    const user = { id: userId, email: normalizedEmail, role, token_version: 1 };
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to CodeNest.',
      token,
      user: {
        id: userId,
        name: trimmedName,
        email: normalizedEmail,
        phone: safePhone,
        role,
        xp: 0,
        level: 1
      }
    });
  } catch (error) {
    console.error('Register Error:', error.message);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      success: false,
      message: isDev ? `Server error: ${error.message}` : 'Server error. Please try again.'
    });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid request body.' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password must be strings.' });
    }

    if (password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must not exceed 128 characters.' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update login timestamps
    await pool.execute(
      'UPDATE users SET last_login_at = NOW(), last_active_at = NOW() WHERE id = ?',
      [user.id]
    );

    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [user.id, 'User logged in']
    );

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        xp: user.xp,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      success: false,
      message: isDev ? `Server error: ${error.message}` : 'Server error. Please try again.'
    });
  }
};

// GET /api/auth/profile
export const getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, role, xp, level, created_at, last_login_at, last_active_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Profile Error:', error.message);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      success: false,
      message: isDev ? `Server error: ${error.message}` : 'Server error.'
    });
  }
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  try {
    const userId = req.user.id;

    // Increment token_version to invalidate all existing sessions for this user
    await pool.execute(
      'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
      [userId]
    );

    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, 'User logged out']
    );

    res.json({
      success: true,
      message: 'Logged out successfully. All active sessions have been revoked.'
    });
  } catch (error) {
    console.error('Logout Error:', error.message);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      success: false,
      message: isDev ? `Server error: ${error.message}` : 'Server error. Please try again.'
    });
  }
};
