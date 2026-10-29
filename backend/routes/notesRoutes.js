import express from 'express';
import { getPublishedNotes, getNoteById, downloadNoteFile } from '../controllers/notesController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/notes (Public / Students)
router.get('/', getPublishedNotes);

// GET /api/notes/:id (Public / Students)
router.get('/:id', getNoteById);

// GET /api/notes/:id/download (Authenticated File Download)
router.get('/:id/download', authMiddleware, downloadNoteFile);

export default router;
