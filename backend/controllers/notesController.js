import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatFileType = (fileName, mimeType) => {
  if (fileName) {
    const ext = path.extname(fileName).replace('.', '').toUpperCase();
    if (ext) return ext;
  }
  if (mimeType) {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('msword') || mimeType.includes('document')) return 'DOCX';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPTX';
    if (mimeType.includes('text')) return 'TXT';
    if (mimeType.includes('image')) return 'IMAGE';
  }
  return 'FILE';
};

/**
 * Hardened local file deletion helper (SEC-05)
 * Safely deletes note attachment files strictly within backend/uploads/notes.
 * Defensively rejects:
 * - non-string, null, undefined, empty, or whitespace-only inputs
 * - traversal sequences (../, ..\\)
 * - Windows backslashes, drive-letter paths (C:), UNC paths (\\\\, //)
 * - encoded path characters (%2e, etc.) and NULL bytes
 * - unexpected URL schemes (http:, file:) or formats outside /uploads/notes/<filename>
 * - dotfiles (.env, .git)
 * - paths targeting directories, symlinks, or sibling directories sharing a prefix
 */
export const deleteLocalFile = (fileUrl) => {
  if (typeof fileUrl !== 'string') return false;
  const trimmedUrl = fileUrl.trim();
  if (!trimmedUrl) return false;

  try {
    // 1. Defensively reject path traversal indicators, backslashes, drive letters, UNC, NULL bytes, URL schemes
    if (
      trimmedUrl.includes('..') ||
      trimmedUrl.includes('\\') ||
      trimmedUrl.includes('\0') ||
      trimmedUrl.includes('%') ||
      /^[a-zA-Z]:/.test(trimmedUrl) ||
      trimmedUrl.startsWith('//') ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedUrl)
    ) {
      return false;
    }

    // 2. Reject unexpected URL formats; accept only the expected /uploads/notes/<filename> format
    const expectedPrefix = '/uploads/notes/';
    if (!trimmedUrl.startsWith(expectedPrefix)) {
      return false;
    }

    const fileName = trimmedUrl.slice(expectedPrefix.length);
    // Filename must not be empty, must not contain separators, and cannot be a dotfile
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
      return false;
    }

    // Enforce safe filename pattern matching Multer upload conventions
    // Must begin with an alphanumeric character or underscore/dash, followed by safe characters, no dotfiles
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(fileName)) {
      return false;
    }

    // 3. Resolve intended upload directory
    const uploadDir = path.resolve(__dirname, '..', 'uploads', 'notes');

    // 4. Resolve candidate file path
    const candidatePath = path.resolve(uploadDir, fileName);

    // 5. Enforce separator-aware containment check to prevent sibling directory prefix matching
    const uploadDirWithSep = uploadDir.endsWith(path.sep) ? uploadDir : uploadDir + path.sep;
    if (!candidatePath.startsWith(uploadDirWithSep)) {
      return false;
    }

    // Relative check for defense-in-depth
    const rel = path.relative(uploadDir, candidatePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
      return false;
    }

    // 6. Verify filesystem existence
    if (!fs.existsSync(candidatePath)) {
      return false;
    }

    // 7. Check file attributes via lstat (does NOT follow symlinks)
    const lstat = fs.lstatSync(candidatePath);

    // Conservative symlink handling: refuse to delete or follow symbolic links
    if (lstat.isSymbolicLink()) {
      return false;
    }

    // Target must strictly be a regular file, not a directory or other special file
    if (!lstat.isFile()) {
      return false;
    }

    // 8. Canonical realpath verification
    const realUploadDir = fs.realpathSync(uploadDir);
    const realCandidatePath = fs.realpathSync(candidatePath);
    const realUploadDirWithSep = realUploadDir.endsWith(path.sep) ? realUploadDir : realUploadDir + path.sep;

    if (!realCandidatePath.startsWith(realUploadDirWithSep)) {
      return false;
    }

    // 9. Safely delete legitimate file
    fs.unlinkSync(candidatePath);
    return true;
  } catch (err) {
    console.error('Error removing local file:', err.message);
    return false;
  }
};


// =========================================================================
// STUDENT & PUBLIC ENDPOINTS
// =========================================================================

// GET /api/notes (Get published notes)
export const getPublishedNotes = async (req, res) => {
  try {
    const { course_id, module_id, search } = req.query;

    let query = `
      SELECT 
        n.id, n.title, n.description, n.content, n.course_id, n.module_id,
        n.file_url, n.file_name, n.file_type, n.file_size, n.status,
        n.created_at, n.updated_at,
        c.title AS course_title, c.category AS course_category,
        m.title AS module_title
      FROM notes n
      JOIN courses c ON c.id = n.course_id
      LEFT JOIN modules m ON m.id = n.module_id
      WHERE n.status = 'published'
    `;
    const params = [];

    if (course_id) {
      query += ' AND n.course_id = ?';
      params.push(parseInt(course_id, 10));
    }

    if (module_id) {
      query += ' AND n.module_id = ?';
      params.push(parseInt(module_id, 10));
    }

    if (search && search.trim()) {
      query += ' AND (n.title LIKE ? OR n.description LIKE ? OR n.content LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY n.created_at DESC';

    const [notes] = await pool.execute(query, params);

    res.json({
      success: true,
      count: notes.length,
      notes
    });
  } catch (error) {
    console.error('Get Published Notes Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching notes.' });
  }
};

// GET /api/notes/:id (Get single note detail)
export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const isOwner = req.user && req.user.role === 'owner';

    const [rows] = await pool.execute(
      `SELECT 
        n.id, n.title, n.description, n.content, n.course_id, n.module_id,
        n.file_url, n.file_name, n.file_type, n.file_size, n.status,
        n.created_at, n.updated_at,
        c.title AS course_title, c.category AS course_category,
        m.title AS module_title
       FROM notes n
       JOIN courses c ON c.id = n.course_id
       LEFT JOIN modules m ON m.id = n.module_id
       WHERE n.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const note = rows[0];

    // Non-owners can only see published notes
    if (note.status !== 'published' && !isOwner) {
      return res.status(404).json({ success: false, message: 'Note not found or unpublished.' });
    }

    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Get Note By ID Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching note detail.' });
  }
};

// GET /api/notes/:id/download (Authenticated File Download)
export const downloadNoteFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Authentication required.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, title, file_url, file_name, status FROM notes WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const note = rows[0];

    if (!note.file_url) {
      return res.status(404).json({ success: false, message: 'No file attachment found for this note.' });
    }

    const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const userEmail = typeof req.user.email === 'string' ? req.user.email.trim().toLowerCase() : '';
    const isOwner = req.user.role === 'owner' && configuredOwnerEmail && userEmail === configuredOwnerEmail;

    // Students can only download files belonging to published notes
    if (note.status !== 'published' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden. Attachment unavailable or draft note.' });
    }

    // Secure resolution of local file path within uploadDir
    const uploadDir = path.resolve(__dirname, '..', 'uploads', 'notes');
    const relativePath = note.file_url.replace(/^\/uploads\/notes\//, '').replace(/^\/uploads\//, '');
    const fileName = path.basename(relativePath);

    // Prevent path traversal
    const absolutePath = path.resolve(uploadDir, fileName);
    if (!absolutePath.startsWith(uploadDir)) {
      return res.status(400).json({ success: false, message: 'Invalid file path.' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }

    const downloadName = note.file_name || fileName;
    res.download(absolutePath, downloadName);
  } catch (error) {
    console.error('Download Note File Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error downloading note file.' });
  }
};

// =========================================================================
// OWNER ENDPOINTS
// =========================================================================

// GET /api/owner/notes (Get all notes with stats for owner dashboard)
export const getOwnerNotes = async (req, res) => {
  try {
    const { course_id, module_id, status, search } = req.query;

    let query = `
      SELECT 
        n.id, n.title, n.description, n.content, n.course_id, n.module_id,
        n.file_url, n.file_name, n.file_type, n.file_size, n.status,
        n.created_by, n.created_at, n.updated_at,
        c.title AS course_title, c.category AS course_category,
        m.title AS module_title,
        u.name AS author_name, u.email AS author_email
      FROM notes n
      JOIN courses c ON c.id = n.course_id
      LEFT JOIN modules m ON m.id = n.module_id
      LEFT JOIN users u ON u.id = n.created_by
      WHERE 1=1
    `;
    const params = [];

    if (course_id && course_id !== 'All') {
      query += ' AND n.course_id = ?';
      params.push(parseInt(course_id, 10));
    }

    if (module_id && module_id !== 'All') {
      query += ' AND n.module_id = ?';
      params.push(parseInt(module_id, 10));
    }

    if (status && status !== 'All') {
      query += ' AND n.status = ?';
      params.push(status.toLowerCase().trim());
    }

    if (search && search.trim()) {
      query += ' AND (n.title LIKE ? OR n.description LIKE ? OR n.content LIKE ? OR c.title LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY n.created_at DESC';

    const [notes] = await pool.execute(query, params);

    // Compute Summary Stats
    const [[{ total_notes }]] = await pool.execute('SELECT COUNT(*) AS total_notes FROM notes');
    const [[{ published_notes }]] = await pool.execute("SELECT COUNT(*) AS published_notes FROM notes WHERE status = 'published'");
    const [[{ draft_notes }]] = await pool.execute("SELECT COUNT(*) AS draft_notes FROM notes WHERE status = 'draft'");
    const [[{ courses_with_notes }]] = await pool.execute('SELECT COUNT(DISTINCT course_id) AS courses_with_notes FROM notes');

    res.json({
      success: true,
      stats: {
        total_notes: total_notes || 0,
        published_notes: published_notes || 0,
        draft_notes: draft_notes || 0,
        courses_with_notes: courses_with_notes || 0
      },
      count: notes.length,
      notes
    });
  } catch (error) {
    console.error('Get Owner Notes Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching owner notes.' });
  }
};

// POST /api/owner/notes (Create Note)
export const createNote = async (req, res) => {
  try {
    const { title, description, content, course_id, module_id, status } = req.body;
    const userId = req.user.id;

    if (!title || !title.trim()) {
      if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
      return res.status(400).json({ success: false, message: 'Note title is required.' });
    }

    if (!course_id) {
      if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
      return res.status(400).json({ success: false, message: 'Please select a course.' });
    }

    // Verify Course exists
    const [courseRows] = await pool.execute('SELECT id, title FROM courses WHERE id = ?', [course_id]);
    if (courseRows.length === 0) {
      if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
      return res.status(404).json({ success: false, message: 'Selected course not found.' });
    }

    // Verify Module exists if provided
    let verifiedModuleId = null;
    if (module_id && module_id !== 'none' && module_id !== 'null' && module_id !== '') {
      const [modRows] = await pool.execute(
        'SELECT id FROM modules WHERE id = ? AND course_id = ?',
        [module_id, course_id]
      );
      if (modRows.length > 0) {
        verifiedModuleId = parseInt(module_id, 10);
      }
    }

    let fileUrl = null;
    let fileName = null;
    let fileType = null;
    let fileSize = null;

    if (req.file) {
      fileUrl = `/uploads/notes/${req.file.filename}`;
      fileName = req.file.originalname;
      fileType = formatFileType(req.file.originalname, req.file.mimetype);
      fileSize = req.file.size;
    }

    const noteStatus = status === 'published' ? 'published' : 'draft';

    const [result] = await pool.execute(
      `INSERT INTO notes 
        (title, description, content, course_id, module_id, file_url, file_name, file_type, file_size, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        description ? description.trim() : '',
        content ? content.trim() : '',
        parseInt(course_id, 10),
        verifiedModuleId,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        noteStatus,
        userId
      ]
    );

    const noteId = result.insertId;

    // Log Activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Created note: ${title.trim()} (${noteStatus})`]
    );

    const [newNoteRows] = await pool.execute(
      `SELECT 
        n.*, c.title AS course_title, m.title AS module_title
       FROM notes n
       JOIN courses c ON c.id = n.course_id
       LEFT JOIN modules m ON m.id = n.module_id
       WHERE n.id = ?`,
      [noteId]
    );

    res.status(201).json({
      success: true,
      message: 'Note created successfully!',
      note: newNoteRows[0]
    });
  } catch (error) {
    if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
    console.error('Create Note Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error creating note.' });
  }
};

// PUT /api/owner/notes/:id (Update Note)
export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, course_id, module_id, status, remove_file } = req.body;
    const userId = req.user.id;

    const [existingRows] = await pool.execute('SELECT * FROM notes WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const currentNote = existingRows[0];

    // Verify Course
    const targetCourseId = course_id ? parseInt(course_id, 10) : currentNote.course_id;
    const [courseRows] = await pool.execute('SELECT id, title FROM courses WHERE id = ?', [targetCourseId]);
    if (courseRows.length === 0) {
      if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
      return res.status(404).json({ success: false, message: 'Selected course not found.' });
    }

    // Verify Module
    let verifiedModuleId = currentNote.module_id;
    if (module_id !== undefined) {
      if (module_id === 'none' || module_id === '' || module_id === null || module_id === 'null') {
        verifiedModuleId = null;
      } else {
        const [modRows] = await pool.execute(
          'SELECT id FROM modules WHERE id = ? AND course_id = ?',
          [module_id, targetCourseId]
        );
        verifiedModuleId = modRows.length > 0 ? parseInt(module_id, 10) : null;
      }
    }

    let fileUrl = currentNote.file_url;
    let fileName = currentNote.file_name;
    let fileType = currentNote.file_type;
    let fileSize = currentNote.file_size;

    // Handle new uploaded file
    if (req.file) {
      // Clean up previous file
      if (currentNote.file_url) deleteLocalFile(currentNote.file_url);

      fileUrl = `/uploads/notes/${req.file.filename}`;
      fileName = req.file.originalname;
      fileType = formatFileType(req.file.originalname, req.file.mimetype);
      fileSize = req.file.size;
    } else if (remove_file === 'true' || remove_file === true) {
      if (currentNote.file_url) deleteLocalFile(currentNote.file_url);
      fileUrl = null;
      fileName = null;
      fileType = null;
      fileSize = null;
    }

    const updatedTitle = title !== undefined ? title.trim() : currentNote.title;
    const updatedDesc = description !== undefined ? description.trim() : currentNote.description;
    const updatedContent = content !== undefined ? content.trim() : currentNote.content;
    const updatedStatus = status ? (status === 'published' ? 'published' : 'draft') : currentNote.status;

    await pool.execute(
      `UPDATE notes SET
        title = ?,
        description = ?,
        content = ?,
        course_id = ?,
        module_id = ?,
        file_url = ?,
        file_name = ?,
        file_type = ?,
        file_size = ?,
        status = ?
       WHERE id = ?`,
      [
        updatedTitle,
        updatedDesc,
        updatedContent,
        targetCourseId,
        verifiedModuleId,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        updatedStatus,
        id
      ]
    );

    // Log Activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Updated note: ${updatedTitle}`]
    );

    const [updatedRows] = await pool.execute(
      `SELECT 
        n.*, c.title AS course_title, m.title AS module_title
       FROM notes n
       JOIN courses c ON c.id = n.course_id
       LEFT JOIN modules m ON m.id = n.module_id
       WHERE n.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Note updated successfully!',
      note: updatedRows[0]
    });
  } catch (error) {
    if (req.file) deleteLocalFile(`/uploads/notes/${req.file.filename}`);
    console.error('Update Note Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating note.' });
  }
};

// PATCH /api/owner/notes/:id/status (Toggle / Update Status)
export const updateNoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be "draft" or "published".' });
    }

    const [existingRows] = await pool.execute('SELECT id, title, status FROM notes WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const note = existingRows[0];

    await pool.execute('UPDATE notes SET status = ? WHERE id = ?', [status, id]);

    // Log Activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Changed note "${note.title}" status to ${status}`]
    );

    res.json({
      success: true,
      message: `Note is now ${status === 'published' ? 'Published' : 'saved as Draft'}.`,
      status
    });
  } catch (error) {
    console.error('Update Note Status Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error updating note status.' });
  }
};

// DELETE /api/owner/notes/:id (Delete Note)
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [existingRows] = await pool.execute('SELECT id, title, file_url FROM notes WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const note = existingRows[0];

    // Delete attached file from storage if present
    if (note.file_url) {
      deleteLocalFile(note.file_url);
    }

    await pool.execute('DELETE FROM notes WHERE id = ?', [id]);

    // Log Activity
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Deleted note: ${note.title}`]
    );

    res.json({
      success: true,
      message: `Note "${note.title}" deleted successfully.`
    });
  } catch (error) {
    console.error('Delete Note Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error deleting note.' });
  }
};
