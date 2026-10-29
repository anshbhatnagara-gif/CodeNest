import express from 'express';
import {
  getOwnerNotes,
  createNote,
  updateNote,
  updateNoteStatus,
  deleteNote
} from '../controllers/notesController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import ownerMiddleware from '../middleware/ownerMiddleware.js';
import { noteUpload, handleUploadError, validateFileContent } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Owner protection on all note management routes
router.use(authMiddleware, ownerMiddleware);

// GET /api/owner/notes (List & stats)
router.get('/', getOwnerNotes);

// POST /api/owner/notes (Create note with optional file)
router.post('/', noteUpload.single('file'), handleUploadError, validateFileContent, createNote);

// PUT /api/owner/notes/:id (Update note metadata & optional file)
router.put('/:id', noteUpload.single('file'), handleUploadError, validateFileContent, updateNote);

// PATCH /api/owner/notes/:id/status (Toggle publish/draft)
router.patch('/:id/status', updateNoteStatus);

// POST /api/owner/notes/:id/upload (Dedicated file upload)
router.post('/:id/upload', noteUpload.single('file'), handleUploadError, validateFileContent, updateNote);

// DELETE /api/owner/notes/:id (Delete note & file)
router.delete('/:id', deleteNote);

export default router;
