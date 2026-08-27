import express from 'express';
import { getPublishedNotes, getNoteById } from '../controllers/notesController.js';

const router = express.Router();

// GET /api/notes (Public / Students)
router.get('/', getPublishedNotes);

// GET /api/notes/:id (Public / Students)
router.get('/:id', getNoteById);

export default router;
