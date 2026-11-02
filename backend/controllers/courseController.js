import pool from '../config/db.js';

// GET /api/courses
export const getCourses = async (req, res) => {
  try {
    const userId = req.user?.id || null;

    const query = `
      SELECT 
        c.*,
        COALESCE(m.total_modules, 0) AS total_modules,
        COALESCE(e.total_enrolled, 0) AS total_enrolled
        ${userId ? ', COALESCE(ue.is_enrolled, 0) AS is_enrolled' : ', 0 AS is_enrolled'}
      FROM courses c
      LEFT JOIN (SELECT course_id, COUNT(*) AS total_modules FROM modules GROUP BY course_id) m ON m.course_id = c.id
      LEFT JOIN (SELECT course_id, COUNT(*) AS total_enrolled FROM enrollments GROUP BY course_id) e ON e.course_id = c.id
      ${userId ? 'LEFT JOIN (SELECT course_id, 1 AS is_enrolled FROM enrollments WHERE user_id = ?) ue ON ue.course_id = c.id' : ''}
      WHERE c.status = 'published'
      ORDER BY c.id ASC
    `;

    const params = userId ? [userId] : [];
    const [courses] = await pool.execute(query, params);

    if (typeof res.setHeader === 'function') {
      res.setHeader('Vary', 'Authorization');
      if (!userId) {
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      } else {
        res.setHeader('Cache-Control', 'private, no-cache');
      }
    } else if (typeof res.set === 'function') {
      res.set('Vary', 'Authorization');
      if (!userId) {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      } else {
        res.set('Cache-Control', 'private, no-cache');
      }
    }

    res.json({ success: true, courses });
  } catch (error) {
    console.error('Get Courses Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/courses/:id
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const [courses] = await pool.execute('SELECT * FROM courses WHERE id = ?', [id]);
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    const course = courses[0];
    if (course.status === 'draft') {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Parallelize module retrieval and enrollment check
    const [modulesResult, enrollmentResult] = await Promise.all([
      pool.execute('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC', [id]),
      userId
        ? pool.execute('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, id])
        : Promise.resolve([[]])
    ]);

    const modules = modulesResult[0];
    const isEnrolled = enrollmentResult[0].length > 0;

    // Get user progress specifically for modules of this course
    let completedModules = [];
    if (isEnrolled && modules.length > 0) {
      const moduleIds = modules.map((m) => m.id);
      const placeholders = moduleIds.map(() => '?').join(',');
      const [prog] = await pool.execute(
        `SELECT module_id FROM progress WHERE user_id = ? AND module_id IN (${placeholders})`,
        [userId, ...moduleIds]
      );
      completedModules = prog.map(p => p.module_id);
    }

    const progressPercent = modules.length > 0
      ? Math.round((completedModules.length / modules.length) * 100)
      : 0;

    if (typeof res.setHeader === 'function') {
      res.setHeader('Vary', 'Authorization');
      if (!userId) {
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      } else {
        res.setHeader('Cache-Control', 'private, no-cache');
      }
    } else if (typeof res.set === 'function') {
      res.set('Vary', 'Authorization');
      if (!userId) {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      } else {
        res.set('Cache-Control', 'private, no-cache');
      }
    }

    res.json({
      success: true,
      course: {
        ...course,
        modules: modules.map(m => ({
          ...m,
          is_completed: completedModules.includes(m.id)
        })),
        is_enrolled: isEnrolled,
        progress_percent: progressPercent,
        completed_count: completedModules.length,
        total_modules: modules.length
      }
    });
  } catch (error) {
    console.error('Get Course Detail Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/courses/:id/enroll
export const enrollCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [course] = await pool.execute('SELECT id, title, status FROM courses WHERE id = ?', [id]);
    if (course.length === 0 || course[0].status === 'draft') {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Check already enrolled
    const [existing] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Already enrolled in this course.' });
    }

    await pool.execute(
      'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [userId, id]
    );

    await pool.execute(
      'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
      [userId, `Enrolled in: ${course[0].title}`]
    );

    res.status(201).json({
      success: true,
      message: `Successfully enrolled in ${course[0].title}!`
    });
  } catch (error) {
    console.error('Enroll Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
