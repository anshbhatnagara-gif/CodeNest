import express from 'express';
import { updateModule, deleteModule } from '../controllers/ownerModuleController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import ownerMiddleware from '../middleware/ownerMiddleware.js';

const router = express.Router();

// Doubly protected with JWT authentication and owner email verification
router.use(authMiddleware, ownerMiddleware);

// PUT /api/owner/modules/:id (Update module title and/or duration)
router.put('/:id', updateModule);

// DELETE /api/owner/modules/:id (Safe guarded module deletion with sequence compaction)
router.delete('/:id', deleteModule);

export default router;

