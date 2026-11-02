import pool from '../config/db.js';

/**
 * GET /api/owner/courses/:courseId/modules
 * List all modules for a course in order_index ASC order,
 * including student completion counts (completed_count).
 */
export const getCourseModules = async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    if (!courseId || isNaN(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid course ID.' });
    }

    // Verify course exists
    const [courses] = await pool.execute(
      'SELECT id, title, status FROM courses WHERE id = ?',
      [courseId]
    );

    if (!courses || courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const course = courses[0];

    // Fetch modules with completed_count from progress
    const [modules] = await pool.execute(
      `SELECT 
        m.id,
        m.course_id,
        m.title,
        m.order_index,
        m.duration,
        (SELECT COUNT(*) FROM progress p WHERE p.module_id = m.id) AS completed_count
      FROM modules m
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC`,
      [courseId]
    );

    res.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        status: course.status
      },
      modules
    });
  } catch (error) {
    console.error('Owner Get Course Modules Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/owner/courses/:courseId/modules
 * Create a new module for a course.
 * Automatically assigns the next order_index (COALESCE(MAX(order_index), 0) + 1).
 */
export const createModule = async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId, 10);
    if (!courseId || isNaN(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid course ID.' });
    }

    // Verify course exists
    const [courses] = await pool.execute(
      'SELECT id, title FROM courses WHERE id = ?',
      [courseId]
    );

    if (!courses || courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    const { title, duration } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Module title is required.'
      });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Module title must not exceed 200 characters.'
      });
    }

    let finalDuration = '15 min';
    if (duration !== undefined && duration !== null && duration !== '') {
      if (typeof duration !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Duration must be a string.'
        });
      }
      finalDuration = duration.trim();
      if (finalDuration.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Duration must not exceed 50 characters.'
        });
      }
    }

    // Determine the next order_index
    const [maxOrderResult] = await pool.execute(
      'SELECT COALESCE(MAX(order_index), 0) + 1 AS nextOrder FROM modules WHERE course_id = ?',
      [courseId]
    );
    const nextOrder = Number(maxOrderResult[0]?.nextOrder || 1);

    // Insert module
    const [result] = await pool.execute(
      'INSERT INTO modules (course_id, title, order_index, duration) VALUES (?, ?, ?, ?)',
      [courseId, trimmedTitle, nextOrder, finalDuration]
    );

    res.status(201).json({
      success: true,
      message: 'Module created successfully.',
      module: {
        id: result.insertId,
        course_id: courseId,
        title: trimmedTitle,
        order_index: nextOrder,
        duration: finalDuration,
        completed_count: 0
      }
    });
  } catch (error) {
    console.error('Owner Create Module Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/owner/modules/:id
 * Update module title and/or duration.
 * Preserves module ID, course_id, and order_index to safeguard existing student progress.
 */
export const updateModule = async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    if (!moduleId || isNaN(moduleId) || moduleId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid module ID.' });
    }

    // Verify module exists
    const [modules] = await pool.execute(
      'SELECT * FROM modules WHERE id = ?',
      [moduleId]
    );

    if (!modules || modules.length === 0) {
      return res.status(404).json({ success: false, message: 'Module not found.' });
    }

    const existingModule = modules[0];
    const { title, duration } = req.body;

    if (title === undefined && duration === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (title or duration) must be provided for update.'
      });
    }

    let updatedTitle = existingModule.title;
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Module title cannot be empty.'
        });
      }
      updatedTitle = title.trim();
      if (updatedTitle.length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Module title must not exceed 200 characters.'
        });
      }
    }

    let updatedDuration = existingModule.duration;
    if (duration !== undefined) {
      if (typeof duration !== 'string' || !duration.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Duration cannot be empty.'
        });
      }
      updatedDuration = duration.trim();
      if (updatedDuration.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Duration must not exceed 50 characters.'
        });
      }
    }

    // Execute update preserving course_id, id, and order_index
    await pool.execute(
      'UPDATE modules SET title = ?, duration = ? WHERE id = ?',
      [updatedTitle, updatedDuration, moduleId]
    );

    // Fetch updated module with completed_count
    const [updatedList] = await pool.execute(
      `SELECT 
        m.id,
        m.course_id,
        m.title,
        m.order_index,
        m.duration,
        (SELECT COUNT(*) FROM progress p WHERE p.module_id = m.id) AS completed_count
      FROM modules m
      WHERE m.id = ?`,
      [moduleId]
    );

    res.json({
      success: true,
      message: 'Module updated successfully.',
      module: updatedList[0]
    });
  } catch (error) {
    console.error('Owner Update Module Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/owner/modules/:id
 * Delete module ONLY if no student progress exists for it.
 * If progress records exist, deletion is blocked with HTTP 400.
 * If safe to delete, removes module and compacts remaining sequence (1..N).
 */
export const deleteModule = async (req, res) => {
  let connection;
  try {
    const moduleId = parseInt(req.params.id, 10);
    if (!moduleId || isNaN(moduleId) || moduleId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid module ID.' });
    }

    // Verify module exists
    const [modules] = await pool.execute(
      'SELECT id, course_id, title, order_index FROM modules WHERE id = ?',
      [moduleId]
    );

    if (!modules || modules.length === 0) {
      return res.status(404).json({ success: false, message: 'Module not found.' });
    }

    const moduleToDelete = modules[0];
    const courseId = moduleToDelete.course_id;

    // Check student progress
    const [progressResult] = await pool.execute(
      'SELECT COUNT(*) AS progressCount FROM progress WHERE module_id = ?',
      [moduleId]
    );
    const progressCount = Number(progressResult[0]?.progressCount || 0);

    if (progressCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete module because student progress records exist for it. Deleting this module would cause student progress loss.',
        progress_count: progressCount
      });
    }

    // Safe deletion & sequence compaction in transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Delete module
    await connection.execute('DELETE FROM modules WHERE id = ?', [moduleId]);

    // 2. Query remaining modules in current order
    const [remaining] = await connection.execute(
      'SELECT id FROM modules WHERE course_id = ? ORDER BY order_index ASC',
      [courseId]
    );

    if (remaining && remaining.length > 0) {
      // 3. Negate order to prevent unique key collisions
      await connection.execute(
        'UPDATE modules SET order_index = -(order_index + 1000) WHERE course_id = ?',
        [courseId]
      );

      // 4. Assign sequential indices 1..N
      for (let i = 0; i < remaining.length; i++) {
        await connection.execute(
          'UPDATE modules SET order_index = ? WHERE id = ? AND course_id = ?',
          [i + 1, remaining[i].id, courseId]
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Module deleted successfully and remaining module sequence compacted.',
      deleted_module_id: moduleId,
      course_id: courseId
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbError) {
        console.error('Rollback error:', rbError.message);
      }
    }
    console.error('Owner Delete Module Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * PUT /api/owner/courses/:courseId/modules/reorder
 * Reorder modules within a course using a two-phase transactional offset
 * to guarantee no collision with uq_course_module_order.
 */
export const reorderModules = async (req, res) => {
  let connection;
  try {
    const courseId = parseInt(req.params.courseId, 10);
    if (!courseId || isNaN(courseId) || courseId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid course ID.' });
    }

    // Verify course exists
    const [courses] = await pool.execute(
      'SELECT id, title FROM courses WHERE id = ?',
      [courseId]
    );

    if (!courses || courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Normalize payload
    let targetOrders = [];
    const body = req.body || {};

    if (Array.isArray(body.module_orders)) {
      targetOrders = body.module_orders;
    } else if (Array.isArray(body.module_ids)) {
      targetOrders = body.module_ids.map((id, index) => ({ id, order_index: index + 1 }));
    } else if (Array.isArray(body.modules)) {
      if (body.modules.length > 0 && typeof body.modules[0] === 'object') {
        targetOrders = body.modules;
      } else {
        targetOrders = body.modules.map((id, index) => ({ id, order_index: index + 1 }));
      }
    } else if (Array.isArray(body)) {
      if (body.length > 0 && typeof body[0] === 'object') {
        targetOrders = body;
      } else {
        targetOrders = body.map((id, index) => ({ id, order_index: index + 1 }));
      }
    }

    if (!targetOrders || targetOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing module ordering payload.'
      });
    }

    // Fetch existing modules for this course
    const [existingModules] = await pool.execute(
      'SELECT id, order_index FROM modules WHERE course_id = ? ORDER BY order_index ASC',
      [courseId]
    );

    if (!existingModules || existingModules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Course has no modules to reorder.'
      });
    }

    if (targetOrders.length !== existingModules.length) {
      return res.status(400).json({
        success: false,
        message: `Module count mismatch. Expected ${existingModules.length} modules, got ${targetOrders.length}. Complete ordering is required.`
      });
    }

    const existingIdsSet = new Set(existingModules.map(m => m.id));
    const seenIds = new Set();
    const seenOrders = new Set();
    const normalizedTarget = [];

    for (let i = 0; i < targetOrders.length; i++) {
      const item = targetOrders[i];
      const modId = parseInt(item?.id, 10);
      const modOrder = parseInt(item?.order_index !== undefined ? item.order_index : (i + 1), 10);

      if (!modId || isNaN(modId) || !existingIdsSet.has(modId)) {
        return res.status(400).json({
          success: false,
          message: `Module ID ${item?.id} is invalid or does not belong to course ${courseId}.`
        });
      }

      if (seenIds.has(modId)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate module ID ${modId} in reorder request.`
        });
      }
      seenIds.add(modId);

      if (isNaN(modOrder) || modOrder < 1 || modOrder > existingModules.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid order_index ${item?.order_index}. Values must be between 1 and ${existingModules.length}.`
        });
      }

      if (seenOrders.has(modOrder)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate order_index ${modOrder} in reorder request.`
        });
      }
      seenOrders.add(modOrder);

      normalizedTarget.push({ id: modId, order_index: modOrder });
    }

    // Transaction execution with Two-Phase Offset Strategy
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Phase 1: Negate order indices to eliminate collisions
    await connection.execute(
      'UPDATE modules SET order_index = -(order_index + 1000) WHERE course_id = ?',
      [courseId]
    );

    // Phase 2: Assign target order indices
    for (const item of normalizedTarget) {
      await connection.execute(
        'UPDATE modules SET order_index = ? WHERE id = ? AND course_id = ?',
        [item.order_index, item.id, courseId]
      );
    }

    await connection.commit();

    // Fetch updated ordered modules
    const [updatedModules] = await pool.execute(
      `SELECT 
        m.id,
        m.course_id,
        m.title,
        m.order_index,
        m.duration,
        (SELECT COUNT(*) FROM progress p WHERE p.module_id = m.id) AS completed_count
      FROM modules m
      WHERE m.course_id = ?
      ORDER BY m.order_index ASC`,
      [courseId]
    );

    res.json({
      success: true,
      message: 'Modules reordered successfully.',
      modules: updatedModules
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbError) {
        console.error('Rollback error:', rbError.message);
      }
    }
    console.error('Owner Reorder Modules Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

