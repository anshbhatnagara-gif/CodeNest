import express from 'express';
import {
  getOwnerCourses,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse
} from '../controllers/ownerCourseController.js';
import {
  getCourseModules,
  createModule,
  reorderModules
} from '../controllers/ownerModuleController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import ownerMiddleware from '../middleware/ownerMiddleware.js';

const router = express.Router();

// Doubly protected with JWT authentication and owner email verification
router.use(authMiddleware, ownerMiddleware);

// GET /api/owner/courses (List all courses including drafts, with stats and filters)
router.get('/', getOwnerCourses);

// POST /api/owner/courses (Create new course, defaults to draft)
router.post('/', createCourse);

// Course module management routes
// GET /api/owner/courses/:courseId/modules (List modules with progress counts)
router.get('/:courseId/modules', getCourseModules);

// POST /api/owner/courses/:courseId/modules (Add module with auto order_index)
router.post('/:courseId/modules', createModule);

// PUT /api/owner/courses/:courseId/modules/reorder (Transactional two-phase reorder)
router.put('/:courseId/modules/reorder', reorderModules);

// PUT /api/owner/courses/:id (Update course details)
router.put('/:id', updateCourse);

// PATCH /api/owner/courses/:id/status (Toggle draft/published)
router.patch('/:id/status', updateCourseStatus);

// DELETE /api/owner/courses/:id (Safe guarded delete)
router.delete('/:id', deleteCourse);

export default router;
