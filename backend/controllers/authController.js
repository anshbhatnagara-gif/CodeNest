import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Auto-assign owner role
    const ownerEmail = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
    const role = (ownerEmail && normalizedEmail === ownerEmail) ? 'owner' : 'student';

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, phone, password, role, last_active_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name.trim(), normalizedEmail, phone ? phone.trim() : '', hashedPassword, role]
    );

    const userId = result.insertId;

    // Log activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, 'Account registered']
    );

    const user = { id: userId, email: normalizedEmail, role };
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to CodeNest.',
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : '',
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
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
