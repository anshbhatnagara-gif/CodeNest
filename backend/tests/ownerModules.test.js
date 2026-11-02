import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import ownerCourseRoutes from '../routes/ownerCourseRoutes.js';
import ownerModuleRoutes from '../routes/ownerModuleRoutes.js';
import {
  getCourseModules,
  createModule,
  updateModule,
  deleteModule,
  reorderModules
} from '../controllers/ownerModuleController.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
};

describe('Owner Module Management Test Suite', () => {
  const originalEnvOwnerEmail = process.env.OWNER_EMAIL;
  const originalSecret = process.env.JWT_SECRET;
  const mockOwnerEmail = 'owner@codenest.com';
  const testSecret = 'test-secret-key-for-owner-module-suite-32chars';

  beforeEach(() => {
    process.env.OWNER_EMAIL = mockOwnerEmail;
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.OWNER_EMAIL = originalEnvOwnerEmail;
    process.env.JWT_SECRET = originalSecret;
  });

  const generateOwnerToken = () => {
    return jwt.sign(
      { id: 1, email: mockOwnerEmail, role: 'owner', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  };

  const generateStudentToken = () => {
    return jwt.sign(
      { id: 99, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  };

  const setupTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/owner/courses', ownerCourseRoutes);
    app.use('/api/owner/modules', ownerModuleRoutes);
    return app;
  };

  // ==========================================================================
  // 1. RBAC & OWNER AUTHORIZATION TESTS
  // ==========================================================================

  test('1. Unauthenticated requests to owner module routes return HTTP 401', async () => {
    const testApp = setupTestApp();
    const server = await new Promise(r => {
      const s = testApp.listen(0, '127.0.0.1', () => r(s));
    });
    const port = server.address().port;

    try {
      const endpoints = [
        { url: `http://127.0.0.1:${port}/api/owner/courses/1/modules`, method: 'GET' },
        { url: `http://127.0.0.1:${port}/api/owner/courses/1/modules`, method: 'POST', body: { title: 'Test' } },
        { url: `http://127.0.0.1:${port}/api/owner/courses/1/modules/reorder`, method: 'PUT', body: { module_ids: [1] } },
        { url: `http://127.0.0.1:${port}/api/owner/modules/1`, method: 'PUT', body: { title: 'Test' } },
        { url: `http://127.0.0.1:${port}/api/owner/modules/1`, method: 'DELETE' }
      ];

      for (const ep of endpoints) {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined
        });
        assert.equal(res.status, 401, `Expected 401 for ${ep.method} ${ep.url}`);
        const data = await res.json();
        assert.equal(data.success, false);
      }
    } finally {
      await new Promise(r => server.close(r));
    }
  });

  test('2. Student users calling owner module endpoints receive HTTP 403 Forbidden', async () => {
    const testApp = setupTestApp();
    const server = await new Promise(r => {
      const s = testApp.listen(0, '127.0.0.1', () => r(s));
    });
    const port = server.address().port;

    const studentToken = generateStudentToken();

    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        return [[{ id: 99, name: 'Student Test', email: 'student@example.com', role: 'student', token_version: 1 }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    };

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/owner/courses/1/modules`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /owner access only/i);
    } finally {
      pool.execute = originalExecute;
      await new Promise(r => server.close(r));
    }
  });

  // ==========================================================================
  // 2. GET /api/owner/courses/:courseId/modules
  // ==========================================================================

  test('3. GET modules with invalid courseId returns HTTP 400', async () => {
    const req = { params: { courseId: 'invalid-id' } };
    const res = createMockRes();

    await getCourseModules(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid course id/i);
  });

  test('4. GET modules for non-existent course returns HTTP 404', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '999' } };
      const res = createMockRes();

      await getCourseModules(req, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /course not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('5. GET modules returns modules ordered by order_index with completed_count', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Web Development Basics', status: 'published' }]];
      }
      if (sql.includes('FROM modules m')) {
        return [[
          { id: 101, course_id: 1, title: 'HTML Intro', order_index: 1, duration: '15 min', completed_count: 5 },
          { id: 102, course_id: 1, title: 'CSS Intro', order_index: 2, duration: '20 min', completed_count: 3 },
          { id: 103, course_id: 1, title: 'JS Intro', order_index: 3, duration: '25 min', completed_count: 0 }
        ]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' } };
      const res = createMockRes();

      await getCourseModules(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.course.title, 'Web Development Basics');
      assert.equal(res.body.modules.length, 3);
      assert.equal(res.body.modules[0].completed_count, 5);
      assert.equal(res.body.modules[0].order_index, 1);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 3. POST /api/owner/courses/:courseId/modules
  // ==========================================================================

  test('6. POST module with missing or invalid title returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Web Dev', status: 'published' }]];
      }
      return [[]];
    };

    try {
      const req1 = { params: { courseId: '1' }, body: { title: '' } };
      const res1 = createMockRes();
      await createModule(req1, res1);
      assert.equal(res1.statusCode, 400);
      assert.match(res1.body.message, /title is required/i);

      const req2 = { params: { courseId: '1' }, body: { title: 'A'.repeat(201) } };
      const res2 = createMockRes();
      await createModule(req2, res2);
      assert.equal(res2.statusCode, 400);
      assert.match(res2.body.message, /exceed 200 characters/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('7. POST module with duration > 50 characters returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Web Dev', status: 'published' }]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: { title: 'Module 1', duration: 'D'.repeat(51) } };
      const res = createMockRes();
      await createModule(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /exceed 50 characters/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('8. POST module automatically computes next order_index and defaults duration to 15 min', async () => {
    const originalExecute = pool.execute;
    let insertedValues = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Web Dev', status: 'published' }]];
      }
      if (sql.includes('COALESCE(MAX(order_index)')) {
        return [[{ nextOrder: 4 }]];
      }
      if (sql.includes('INSERT INTO modules')) {
        insertedValues = params;
        return [{ insertId: 555 }];
      }
      return [[]];
    };

    try {
      const req = {
        params: { courseId: '1' },
        body: { title: 'Async JavaScript' }
      };
      const res = createMockRes();

      await createModule(req, res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.module.id, 555);
      assert.equal(res.body.module.order_index, 4);
      assert.equal(res.body.module.duration, '15 min');
      assert.deepEqual(insertedValues, [1, 'Async JavaScript', 4, '15 min']);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('9. POST module accepts custom duration and assigns order 1 if course has no modules', async () => {
    const originalExecute = pool.execute;
    let insertedValues = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 2, title: 'Empty Course', status: 'draft' }]];
      }
      if (sql.includes('COALESCE(MAX(order_index)')) {
        return [[{ nextOrder: 1 }]];
      }
      if (sql.includes('INSERT INTO modules')) {
        insertedValues = params;
        return [{ insertId: 601 }];
      }
      return [[]];
    };

    try {
      const req = {
        params: { courseId: '2' },
        body: { title: 'First Module Ever', duration: '45 mins' }
      };
      const res = createMockRes();

      await createModule(req, res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.module.id, 601);
      assert.equal(res.body.module.order_index, 1);
      assert.equal(res.body.module.duration, '45 mins');
      assert.deepEqual(insertedValues, [2, 'First Module Ever', 1, '45 mins']);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 4. PUT /api/owner/modules/:id
  // ==========================================================================

  test('10. PUT module with non-existent id returns HTTP 404', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM modules WHERE id = ?')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const req = { params: { id: '999' }, body: { title: 'New Title' } };
      const res = createMockRes();

      await updateModule(req, res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /module not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('11. PUT module with empty payload or blank title returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM modules WHERE id = ?')) {
        return [[{ id: 10, course_id: 1, title: 'Old Title', duration: '15 min' }]];
      }
      return [[]];
    };

    try {
      const req1 = { params: { id: '10' }, body: {} };
      const res1 = createMockRes();
      await updateModule(req1, res1);
      assert.equal(res1.statusCode, 400);

      const req2 = { params: { id: '10' }, body: { title: '   ' } };
      const res2 = createMockRes();
      await updateModule(req2, res2);
      assert.equal(res2.statusCode, 400);
      assert.match(res2.body.message, /title cannot be empty/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('12. PUT module successfully updates title and duration while preserving module id, course_id and order_index', async () => {
    const originalExecute = pool.execute;
    let updateParams = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT * FROM modules WHERE id = ?')) {
        return [[{ id: 10, course_id: 1, title: 'Old Title', duration: '15 min', order_index: 3 }]];
      }
      if (sql.includes('UPDATE modules SET title = ?, duration = ? WHERE id = ?')) {
        updateParams = params;
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('FROM modules') && sql.includes('m.id = ?')) {
        return [[{ id: 10, course_id: 1, title: 'Updated Title', duration: '30 min', order_index: 3, completed_count: 2 }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '10' },
        body: { title: 'Updated Title', duration: '30 min' }
      };
      const res = createMockRes();

      await updateModule(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.module.id, 10);
      assert.equal(res.body.module.order_index, 3);
      assert.equal(res.body.module.title, 'Updated Title');
      assert.equal(res.body.module.duration, '30 min');
      assert.deepEqual(updateParams, ['Updated Title', '30 min', 10]);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 5. DELETE /api/owner/modules/:id
  // ==========================================================================

  test('13. DELETE module when student progress exists is BLOCKED with HTTP 400', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, course_id, title, order_index FROM modules WHERE id = ?')) {
        return [[{ id: 5, course_id: 1, title: 'Module With Progress', order_index: 2 }]];
      }
      if (sql.includes('COUNT(*) AS progressCount FROM progress')) {
        return [[{ progressCount: 4 }]];
      }
      return [[]];
    };

    try {
      const req = { params: { id: '5' } };
      const res = createMockRes();

      await deleteModule(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /student progress records exist/i);
      assert.equal(res.body.progress_count, 4);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('14. DELETE module when NO progress exists deletes module and compacts remaining sequence', async () => {
    const originalExecute = pool.execute;
    const originalGetConnection = pool.getConnection;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, course_id, title, order_index FROM modules WHERE id = ?')) {
        return [[{ id: 2, course_id: 1, title: 'Module Without Progress', order_index: 2 }]];
      }
      if (sql.includes('COUNT(*) AS progressCount FROM progress')) {
        return [[{ progressCount: 0 }]];
      }
      return [[]];
    };

    const mockConnStatements = [];
    const mockConn = {
      beginTransaction: async () => { mockConnStatements.push('BEGIN'); },
      commit: async () => { mockConnStatements.push('COMMIT'); },
      rollback: async () => { mockConnStatements.push('ROLLBACK'); },
      release: () => { mockConnStatements.push('RELEASE'); },
      execute: async (sql, params) => {
        mockConnStatements.push({ sql, params });
        if (sql.includes('DELETE FROM modules WHERE id = ?')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('SELECT id FROM modules WHERE course_id = ? ORDER BY order_index ASC')) {
          // Remaining modules originally at index 1 and 3 (now need to be 1 and 2)
          return [[{ id: 1 }, { id: 3 }]];
        }
        if (sql.includes('UPDATE modules SET order_index')) {
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }
    };
    pool.getConnection = async () => mockConn;

    try {
      const req = { params: { id: '2' } };
      const res = createMockRes();

      await deleteModule(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /deleted successfully and remaining module sequence compacted/i);

      assert.ok(mockConnStatements.includes('BEGIN'));
      assert.ok(mockConnStatements.includes('COMMIT'));
      assert.ok(mockConnStatements.includes('RELEASE'));

      // Verify negative offset was executed to prevent uq_course_module_order collision
      const offsetCall = mockConnStatements.find(s => typeof s === 'object' && s.sql.includes('order_index = -(order_index + 1000)'));
      assert.ok(offsetCall, 'Must execute negative offset step');

      // Verify compaction calls
      const compactionCalls = mockConnStatements.filter(s => typeof s === 'object' && s.sql.includes('SET order_index = ? WHERE id = ?'));
      assert.equal(compactionCalls.length, 2);
      assert.deepEqual(compactionCalls[0].params, [1, 1, 1]); // order 1 for id 1
      assert.deepEqual(compactionCalls[1].params, [2, 3, 1]); // order 2 for id 3
    } finally {
      pool.execute = originalExecute;
      pool.getConnection = originalGetConnection;
    }
  });

  // ==========================================================================
  // 6. PUT /api/owner/courses/:courseId/modules/reorder
  // ==========================================================================

  test('15. Reorder with missing or empty payload returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: {} };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /invalid or missing module ordering payload/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('16. Reorder when course has no modules returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ?')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: { module_ids: [1, 2] } };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /has no modules to reorder/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('17. Reorder with count mismatch returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ?')) {
        return [[{ id: 10, order_index: 1 }, { id: 20, order_index: 2 }, { id: 30, order_index: 3 }]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: { module_ids: [10, 20] } };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /module count mismatch/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('18. Reorder with foreign module ID returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ?')) {
        return [[{ id: 10, order_index: 1 }, { id: 20, order_index: 2 }]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: { module_ids: [10, 999] } };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /does not belong to course/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('19. Reorder with duplicate module ID returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ?')) {
        return [[{ id: 10, order_index: 1 }, { id: 20, order_index: 2 }]];
      }
      return [[]];
    };

    try {
      const req = { params: { courseId: '1' }, body: { module_ids: [10, 10] } };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /duplicate module id/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('20. Reorder with duplicate order_index returns HTTP 400', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ?')) {
        return [[{ id: 10, order_index: 1 }, { id: 20, order_index: 2 }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { courseId: '1' },
        body: {
          module_orders: [
            { id: 10, order_index: 1 },
            { id: 20, order_index: 1 }
          ]
        }
      };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /duplicate order_index/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('21. Successful reordering executes two-phase offset and assigns new positive indices', async () => {
    const originalExecute = pool.execute;
    const originalGetConnection = pool.getConnection;

    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ? ORDER BY order_index ASC')) {
        return [[
          { id: 10, order_index: 1 },
          { id: 20, order_index: 2 },
          { id: 30, order_index: 3 }
        ]];
      }
      if (sql.includes('FROM modules') && sql.includes('m.course_id = ?')) {
        return [[
          { id: 30, course_id: 1, title: 'Module 3', order_index: 1, duration: '15 min', completed_count: 0 },
          { id: 10, course_id: 1, title: 'Module 1', order_index: 2, duration: '15 min', completed_count: 1 },
          { id: 20, course_id: 1, title: 'Module 2', order_index: 3, duration: '15 min', completed_count: 2 }
        ]];
      }
      return [[]];
    };

    const mockConnStatements = [];
    const mockConn = {
      beginTransaction: async () => { mockConnStatements.push('BEGIN'); },
      commit: async () => { mockConnStatements.push('COMMIT'); },
      rollback: async () => { mockConnStatements.push('ROLLBACK'); },
      release: () => { mockConnStatements.push('RELEASE'); },
      execute: async (sql, params) => {
        mockConnStatements.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
    };
    pool.getConnection = async () => mockConn;

    try {
      const req = {
        params: { courseId: '1' },
        body: { module_ids: [30, 10, 20] } // 30 -> 1, 10 -> 2, 20 -> 3
      };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.modules.length, 3);
      assert.equal(res.body.modules[0].id, 30);
      assert.equal(res.body.modules[0].order_index, 1);

      assert.ok(mockConnStatements.includes('BEGIN'));
      assert.ok(mockConnStatements.includes('COMMIT'));
      assert.ok(mockConnStatements.includes('RELEASE'));

      // Verify Phase 1: Negative offset
      const offsetCall = mockConnStatements.find(s => typeof s === 'object' && s.sql.includes('order_index = -(order_index + 1000)'));
      assert.ok(offsetCall, 'Must execute negative offset step');

      // Verify Phase 2: Updates
      const updateCalls = mockConnStatements.filter(s => typeof s === 'object' && s.sql.includes('UPDATE modules SET order_index = ? WHERE id = ? AND course_id = ?'));
      assert.equal(updateCalls.length, 3);
      assert.deepEqual(updateCalls[0].params, [1, 30, 1]);
      assert.deepEqual(updateCalls[1].params, [2, 10, 1]);
      assert.deepEqual(updateCalls[2].params, [3, 20, 1]);
    } finally {
      pool.execute = originalExecute;
      pool.getConnection = originalGetConnection;
    }
  });

  test('22. Transaction rollbacks on DB error during reorder', async () => {
    const originalExecute = pool.execute;
    const originalGetConnection = pool.getConnection;

    pool.execute = async (sql) => {
      if (sql.includes('FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'Course 1' }]];
      }
      if (sql.includes('FROM modules WHERE course_id = ? ORDER BY order_index ASC')) {
        return [[{ id: 10, order_index: 1 }, { id: 20, order_index: 2 }]];
      }
      return [[]];
    };

    const mockConnStatements = [];
    const mockConn = {
      beginTransaction: async () => { mockConnStatements.push('BEGIN'); },
      commit: async () => { mockConnStatements.push('COMMIT'); },
      rollback: async () => { mockConnStatements.push('ROLLBACK'); },
      release: () => { mockConnStatements.push('RELEASE'); },
      execute: async (sql) => {
        if (sql.includes('UPDATE modules SET order_index = ? WHERE id = ?')) {
          throw new Error('Simulated database deadlock');
        }
        return [{ affectedRows: 1 }];
      }
    };
    pool.getConnection = async () => mockConn;

    try {
      const req = {
        params: { courseId: '1' },
        body: { module_ids: [20, 10] }
      };
      const res = createMockRes();

      await reorderModules(req, res);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /server error/i);

      assert.ok(mockConnStatements.includes('BEGIN'));
      assert.ok(mockConnStatements.includes('ROLLBACK'));
      assert.ok(mockConnStatements.includes('RELEASE'));
    } finally {
      pool.execute = originalExecute;
      pool.getConnection = originalGetConnection;
    }
  });
});
