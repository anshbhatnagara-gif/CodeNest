import pool from '../config/db.js';

const getRegularityStatus = (lastActiveAt) => {
  if (!lastActiveAt) return 'Inactive';
  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now - lastActive;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'Regular';
  if (diffDays <= 7) return 'Less Active';
  return 'Inactive';
};

// GET /api/owner/dashboard
export const getDashboard = async (req, res) => {
  try {
    const [
      [[{ total_students }]],
      [[{ total_enrollments }]],
      [[{ total_completed }]],
      [[{ regular, less_active, inactive } = {}]],
      [recentActivity]
    ] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS total_students FROM users WHERE role = 'student'"),
      pool.execute('SELECT COUNT(*) AS total_enrollments FROM enrollments'),
      pool.execute(`
        SELECT COUNT(DISTINCT e.user_id) AS total_completed
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE (
          SELECT COUNT(*) FROM modules m WHERE m.course_id = e.course_id
        ) = (
          SELECT COUNT(*) FROM progress p JOIN modules m2 ON m2.id = p.module_id
          WHERE p.user_id = e.user_id AND m2.course_id = e.course_id
        ) AND (SELECT COUNT(*) FROM modules m WHERE m.course_id = e.course_id) > 0
      `),
      pool.execute(`
        SELECT 
          COUNT(CASE WHEN last_active_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) AS regular,
          COUNT(CASE WHEN last_active_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND last_active_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) AS less_active,
          COUNT(CASE WHEN last_active_at IS NULL OR last_active_at < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS inactive
        FROM users 
        WHERE role = 'student'
      `),
      pool.execute(
        `SELECT al.action, al.created_at, u.name, u.email 
         FROM activity_logs al 
         JOIN users u ON u.id = al.user_id 
         ORDER BY al.created_at DESC 
         LIMIT 20`
      )
    ]);

    res.json({
      success: true,
      stats: {
        total_students,
        total_enrollments,
        total_completed,
        regular: Number(regular || 0),
        less_active: Number(less_active || 0),
        inactive: Number(inactive || 0)
      },
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Owner Dashboard Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/owner/students
export const getStudents = async (req, res) => {
  try {
    const [students] = await pool.execute(
      `SELECT 
        u.id, u.name, u.email, u.phone, u.xp, u.level,
        u.created_at, u.last_login_at, u.last_active_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS courses_enrolled
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );

    const result = students.map(s => ({
      ...s,
      regularity: getRegularityStatus(s.last_active_at)
    }));

    res.json({ success: true, students: result });
  } catch (error) {
    console.error('Get Students Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/owner/students/:id
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.execute(
      'SELECT id, name, email, phone, xp, level, created_at, last_login_at, last_active_at FROM users WHERE id = ? AND role = "student"',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const student = users[0];

    const [enrollments] = await pool.execute(
      `SELECT 
        c.id, c.title, c.category, e.enrolled_at,
        (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS total_modules,
        (SELECT COUNT(*) FROM progress p JOIN modules m2 ON m2.id = p.module_id WHERE p.user_id = ? AND m2.course_id = c.id) AS completed_modules
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ?`,
      [id, id]
    );

    const [activity] = await pool.execute(
      'SELECT action, created_at FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );

    const coursesWithProgress = enrollments.map(c => ({
      ...c,
      progress_percent: c.total_modules > 0 ? Math.round((c.completed_modules / c.total_modules) * 100) : 0
    }));

    res.json({
      success: true,
      student: {
        ...student,
        regularity: getRegularityStatus(student.last_active_at),
        courses: coursesWithProgress,
        activity_log: activity
      }
    });
  } catch (error) {
    console.error('Get Student Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/owner/activity
export const getActivity = async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT al.id, al.action, al.created_at, u.name, u.email
       FROM activity_logs al
       JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 50`
    );
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Activity Log Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/owner/students/:id
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const [user] = await pool.execute("SELECT id, name FROM users WHERE id = ? AND role = 'student'", [id]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: `Student "${user[0].name}" deleted successfully.` });
  } catch (error) {
    console.error('Delete Student Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
