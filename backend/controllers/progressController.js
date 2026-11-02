import pool from '../config/db.js';

// GET /api/progress/my-courses
export const getMyCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const [enrollments] = await pool.execute(
      `SELECT 
        c.id, c.title, c.thumbnail, c.instructor, c.category, c.difficulty,
        e.enrolled_at,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS total_modules,
        (SELECT COUNT(*) FROM progress p 
         JOIN modules m ON m.id = p.module_id 
         WHERE p.user_id = ? AND m.course_id = c.id) AS completed_modules
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`,
      [userId, userId]
    );

    const courses = enrollments.map(c => ({
      ...c,
      progress_percent: c.total_modules > 0
        ? Math.round((c.completed_modules / c.total_modules) * 100)
        : 0
    }));

    res.json({ success: true, courses });
  } catch (error) {
    console.error('My Courses Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/progress/module-complete
export const completeModule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { module_id } = req.body;

    if (!module_id) {
      return res.status(400).json({ success: false, message: 'module_id is required.' });
    }

    // Verify module exists and check user enrollment in a single combined query
    const [moduleRows] = await pool.execute(
      `SELECT m.id, m.title, m.course_id, c.title AS course_title, e.id AS enrollment_id
       FROM modules m
       JOIN courses c ON c.id = m.course_id
       LEFT JOIN enrollments e ON e.course_id = m.course_id AND e.user_id = ?
       WHERE m.id = ?`,
      [userId, module_id]
    );

    if (moduleRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Module not found.' });
    }

    const module = moduleRows[0];

    if (!module.enrollment_id) {
      return res.status(403).json({ success: false, message: 'Please enroll in the course first.' });
    }

    // Insert progress (ignore duplicate)
    const [existing] = await pool.execute(
      'SELECT id FROM progress WHERE user_id = ? AND module_id = ?',
      [userId, module_id]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Module already marked as completed.', already_done: true });
    }

    await pool.execute(
      'INSERT INTO progress (user_id, module_id) VALUES (?, ?)',
      [userId, module_id]
    );

    // Add XP (+50 per module)
    await pool.execute(
      'UPDATE users SET xp = xp + 50, level = FLOOR((xp + 50) / 500) + 1, last_active_at = NOW() WHERE id = ?',
      [userId]
    );

    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Completed module: ${module.title}`]
    );

    // Parallelize course module count checks
    const [[totalMods], [doneMods]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS total FROM modules WHERE course_id = ?', [module.course_id]),
      pool.execute(
        `SELECT COUNT(*) AS done FROM progress p
         JOIN modules m ON m.id = p.module_id
         WHERE p.user_id = ? AND m.course_id = ?`,
        [userId, module.course_id]
      )
    ]);

    const total = totalMods[0].total;
    const done = doneMods[0].done;
    const courseCompleted = total === done;

    if (courseCompleted) {
      // Bonus XP for completing course
      await pool.execute(
        'UPDATE users SET xp = xp + 200, level = FLOOR((xp + 200) / 500) + 1 WHERE id = ?',
        [userId]
      );
      await pool.execute(
        'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
        [userId, `Course completed: ${module.course_title}`]
      );
    }

    res.json({
      success: true,
      message: 'Module completed! +50 XP earned.',
      xp_gained: 50,
      course_completed: courseCompleted,
      bonus_xp: courseCompleted ? 200 : 0
    });
  } catch (error) {
    console.error('Complete Module Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
