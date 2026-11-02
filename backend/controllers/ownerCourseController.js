import pool from '../config/db.js';

/**
 * GET /api/owner/courses
 * List all courses (including drafts) with module and enrollment statistics.
 * Supports ?status=draft|published|all and ?search=keyword
 */
export const getOwnerCourses = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS total_modules,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS total_enrolled,
        (SELECT COUNT(*) FROM notes n WHERE n.course_id = c.id) AS total_notes
      FROM courses c
    `;

    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (normalizedStatus === 'draft' || normalizedStatus === 'published') {
        conditions.push('c.status = ?');
        params.push(normalizedStatus);
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(c.title) LIKE ? OR LOWER(c.category) LIKE ? OR LOWER(c.description) LIKE ? OR LOWER(c.instructor) LIKE ?)');
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY c.id ASC';

    const [courses] = await pool.execute(query, params);

    res.json({
      success: true,
      courses
    });
  } catch (error) {
    console.error('Owner Get Courses Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/owner/courses
 * Create a new course.
 * Defaults new courses to 'draft'.
 * Validates required fields and checks duplicate title.
 */
export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description = '',
      category = 'General',
      difficulty = 'Beginner',
      duration = '0 hours',
      thumbnail = '',
      instructor = req.user?.name || 'CodeNest Faculty',
      status = 'draft'
    } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course title is required.'
      });
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Course title cannot exceed 200 characters.'
      });
    }

    // Validate difficulty
    const allowedDifficulties = ['Beginner', 'Intermediate', 'Advanced'];
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Invalid difficulty level. Allowed values: 'Beginner', 'Intermediate', 'Advanced'."
      });
    }

    // Validate status (default is draft)
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!['draft', 'published'].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values: 'draft', 'published'."
      });
    }

    // Check duplicate title
    const [existing] = await pool.execute(
      'SELECT id FROM courses WHERE LOWER(title) = LOWER(?)',
      [cleanTitle]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A course with this title already exists.'
      });
    }

    const cleanCategory = typeof category === 'string' ? category.trim().substring(0, 100) : 'General';
    const cleanDuration = typeof duration === 'string' ? duration.trim().substring(0, 50) : '0 hours';
    const cleanThumbnail = typeof thumbnail === 'string' ? thumbnail.trim().substring(0, 500) : '';
    const cleanInstructor = typeof instructor === 'string' ? instructor.trim().substring(0, 100) : 'CodeNest Faculty';
    const cleanDescription = typeof description === 'string' ? description.trim() : '';

    const [result] = await pool.execute(
      `INSERT INTO courses (title, description, category, difficulty, duration, thumbnail, instructor, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanTitle,
        cleanDescription,
        cleanCategory,
        difficulty,
        cleanDuration,
        cleanThumbnail,
        cleanInstructor,
        normalizedStatus
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      course: {
        id: result.insertId,
        title: cleanTitle,
        description: cleanDescription,
        category: cleanCategory,
        difficulty,
        duration: cleanDuration,
        thumbnail: cleanThumbnail,
        instructor: cleanInstructor,
        status: normalizedStatus
      }
    });
  } catch (error) {
    console.error('Owner Create Course Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/owner/courses/:id
 * Update course metadata.
 * Validates inputs and prevents duplicate course titles.
 */
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ?', [id]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    const current = courses[0];

    const {
      title,
      description,
      category,
      difficulty,
      duration,
      thumbnail,
      instructor,
      status
    } = req.body;

    let cleanTitle = current.title;
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Course title cannot be empty.' });
      }
      cleanTitle = title.trim();
      if (cleanTitle.length > 200) {
        return res.status(400).json({ success: false, message: 'Course title cannot exceed 200 characters.' });
      }

      // If title changed, check duplicate
      if (cleanTitle.toLowerCase() !== current.title.toLowerCase()) {
        const [existing] = await pool.execute(
          'SELECT id FROM courses WHERE LOWER(title) = LOWER(?) AND id != ?',
          [cleanTitle, id]
        );
        if (existing.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Another course with this title already exists.'
          });
        }
      }
    }

    let cleanDifficulty = current.difficulty;
    if (difficulty !== undefined) {
      const allowed = ['Beginner', 'Intermediate', 'Advanced'];
      if (!allowed.includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: "Invalid difficulty level. Allowed values: 'Beginner', 'Intermediate', 'Advanced'."
        });
      }
      cleanDifficulty = difficulty;
    }

    let cleanStatus = current.status;
    if (status !== undefined) {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (!['draft', 'published'].includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Allowed values: 'draft', 'published'."
        });
      }
      cleanStatus = normalizedStatus;
    }

    const cleanDescription = description !== undefined
      ? (typeof description === 'string' ? description.trim() : '')
      : current.description;

    const cleanCategory = category !== undefined
      ? (typeof category === 'string' ? category.trim().substring(0, 100) : current.category)
      : current.category;

    const cleanDuration = duration !== undefined
      ? (typeof duration === 'string' ? duration.trim().substring(0, 50) : current.duration)
      : current.duration;

    const cleanThumbnail = thumbnail !== undefined
      ? (typeof thumbnail === 'string' ? thumbnail.trim().substring(0, 500) : current.thumbnail)
      : current.thumbnail;

    const cleanInstructor = instructor !== undefined
      ? (typeof instructor === 'string' ? instructor.trim().substring(0, 100) : current.instructor)
      : current.instructor;

    await pool.execute(
      `UPDATE courses SET
        title = ?,
        description = ?,
        category = ?,
        difficulty = ?,
        duration = ?,
        thumbnail = ?,
        instructor = ?,
        status = ?
       WHERE id = ?`,
      [
        cleanTitle,
        cleanDescription,
        cleanCategory,
        cleanDifficulty,
        cleanDuration,
        cleanThumbnail,
        cleanInstructor,
        cleanStatus,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Course updated successfully.',
      course: {
        id: Number(id),
        title: cleanTitle,
        description: cleanDescription,
        category: cleanCategory,
        difficulty: cleanDifficulty,
        duration: cleanDuration,
        thumbnail: cleanThumbnail,
        instructor: cleanInstructor,
        status: cleanStatus
      }
    });
  } catch (error) {
    console.error('Owner Update Course Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PATCH /api/owner/courses/:id/status
 * Update course status (draft/published).
 */
export const updateCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Status is required. Allowed values: 'draft', 'published'."
      });
    }

    const normalizedStatus = status.trim().toLowerCase();
    if (!['draft', 'published'].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values: 'draft', 'published'."
      });
    }

    const [courses] = await pool.execute('SELECT id, title, status FROM courses WHERE id = ?', [id]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    await pool.execute('UPDATE courses SET status = ? WHERE id = ?', [normalizedStatus, id]);

    res.json({
      success: true,
      message: `Course status updated to ${normalizedStatus}.`,
      status: normalizedStatus
    });
  } catch (error) {
    console.error('Owner Update Status Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/owner/courses/:id
 * Delete a course only if no enrollments exist.
 * Never force-deletes if students are enrolled.
 */
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const [courses] = await pool.execute('SELECT id, title FROM courses WHERE id = ?', [id]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Check active enrollments
    const [[{ enrollCount }]] = await pool.execute(
      'SELECT COUNT(*) as enrollCount FROM enrollments WHERE course_id = ?',
      [id]
    );

    if (enrollCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete course with active student enrollments. Unpublish the course instead.'
      });
    }

    await pool.execute('DELETE FROM courses WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Course deleted successfully.'
    });
  } catch (error) {
    console.error('Owner Delete Course Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

