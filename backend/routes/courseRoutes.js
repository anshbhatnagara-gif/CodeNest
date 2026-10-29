import express from 'express';
import { getCourses, getCourseById, enrollCourse } from '../controllers/courseController.js';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public with optional auth (to get enrollment status)
router.get('/', optionalAuthMiddleware, getCourses);
router.get('/:id', optionalAuthMiddleware, getCourseById);

// Protected
router.post('/:id/enroll', authMiddleware, enrollCourse);

export default router;
