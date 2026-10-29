import express from 'express';
import { register, login, getProfile, logout } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import authRateLimiter from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', authMiddleware, logout);
router.get('/profile', authMiddleware, getProfile);

export default router;
