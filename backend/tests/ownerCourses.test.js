
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import ownerCourseRoutes from '../routes/ownerCourseRoutes.js';
import courseRoutes from '../routes/courseRoutes.js';
import {
  getOwnerCourses,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse
} from '../controllers/ownerCourseController.js';
import {
  getCourses,
  getCourseById,
  enrollCourse
} from '../controllers/courseController.js';

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

describe('Owner Course Management Test Suite', () => {
  const originalEnvOwnerEmail = process.env.OWNER_EMAIL;
  const originalSecret = process.env.JWT_SECRET;
  const mockOwnerEmail = 'owner@codenest.com';
  const testSecret = 'test-secret-key-for-owner-course-suite-32chars';

  beforeEach(() => {
    process.env.OWNER_EMAIL = mockOwnerEmail;
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.OWNER_EMAIL = originalEnvOwnerEmail;
    process.env.JWT_SECRET = originalSecret;
  });

  // ==========================================================================
  // 1. RBAC & OWNER AUTHORIZATION TESTS
  // ==========================================================================

  test('1. Unauthenticated requests to owner course routes return HTTP 401', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/owner/courses', ownerCourseRoutes);

    const server = await new Promise(r => {
      const s = testApp.listen(0, '127.0.0.1', () => r(s));
    });
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/owner/courses`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    } finally {
      await new Promise(r => server.close(r));
    }
  });

  test('2. Student users calling owner course routes receive HTTP 403 Forbidden', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/owner/courses', ownerCourseRoutes);

    const server = await new Promise(r => {
      const s = testApp.listen(0, '127.0.0.1', () => r(s));
    });
    const port = server.address().port;

    const studentToken = jwt.sign(
      { id: 99, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

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
      const res = await fetch(`http://127.0.0.1:${port}/api/owner/courses`, {
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

  test('3. Properly authorized Owner user receives HTTP 200 on owner courses listing', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/owner/courses', ownerCourseRoutes);

    const server = await new Promise(r => {
      const s = testApp.listen(0, '127.0.0.1', () => r(s));
    });
    const port = server.address().port;

    const ownerToken = jwt.sign(
      { id: 1, email: mockOwnerEmail, role: 'owner', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('FROM users WHERE id = ?')) {
        return [[{ id: 1, name: 'Owner Admin', email: mockOwnerEmail, role: 'owner', token_version: 1 }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('FROM courses c')) {
        return [[
          { id: 1, title: 'HTML Basics', status: 'published', total_modules: 8, total_enrolled: 5 },
          { id: 2, title: 'Advanced Rust', status: 'draft', total_modules: 0, total_enrolled: 0 }
        ]];
      }
      return [[]];
    };

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/owner/courses`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.courses.length, 2);
    } finally {
      pool.execute = originalExecute;
      await new Promise(r => server.close(r));
    }
  });

  // ==========================================================================
  // 2. COURSE LISTING & FILTERING
  // ==========================================================================

  test('4. GET /api/owner/courses returns both draft and published courses with metrics', async () => {
    const originalExecute = pool.execute;
    let executedSql = '';

    pool.execute = async (sql) => {
      executedSql = sql;
      return [[
        { id: 1, title: 'HTML Basics', status: 'published', total_modules: 8, total_enrolled: 2 },
        { id: 2, title: 'Rust Masterclass', status: 'draft', total_modules: 4, total_enrolled: 0 }
      ]];
    };

    try {
      const req = { query: {} };
      const res = createMockRes();

      await getOwnerCourses(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.courses.length, 2);
      assert.equal(res.body.courses[0].status, 'published');
      assert.equal(res.body.courses[1].status, 'draft');
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('5. GET /api/owner/courses applies status filter correctly', async () => {
    const originalExecute = pool.execute;
    let capturedParams = [];

    pool.execute = async (sql, params) => {
      capturedParams = params;
      return [[{ id: 2, title: 'Rust Masterclass', status: 'draft' }]];
    };

    try {
      const req = { query: { status: 'draft' } };
      const res = createMockRes();

      await getOwnerCourses(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.courses[0].status, 'draft');
      assert.equal(capturedParams[0], 'draft');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 3. CREATE COURSE VALIDATION & DUPLICATE CHECKS
  // ==========================================================================

  test('6. POST /api/owner/courses rejects missing or empty title with 400', async () => {
    const req = { body: { title: '   ' } };
    const res = createMockRes();

    await createCourse(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /title is required/i);
  });

  test('7. POST /api/owner/courses rejects invalid difficulty level with 400', async () => {
    const req = { body: { title: 'New Course', difficulty: 'Expert' } };
    const res = createMockRes();

    await createCourse(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid difficulty/i);
  });

  test('8. POST /api/owner/courses rejects invalid status value with 400', async () => {
    const req = { body: { title: 'New Course', status: 'archived' } };
    const res = createMockRes();

    await createCourse(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid status/i);
  });

  test('9. POST /api/owner/courses defaults new courses to "draft" when status is omitted', async () => {
    const originalExecute = pool.execute;
    let insertedStatus = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM courses WHERE LOWER(title)')) {
        return [[]]; // Title is unique
      }
      if (sql.includes('INSERT INTO courses')) {
        insertedStatus = params[7]; // status is 8th parameter
        return [{ insertId: 201 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          title: 'Docker & Kubernetes',
          category: 'DevOps',
          difficulty: 'Intermediate'
        },
        user: { name: 'Owner Admin' }
      };
      const res = createMockRes();

      await createCourse(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(insertedStatus, 'draft');
      assert.equal(res.body.course.status, 'draft');
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('10. POST /api/owner/courses rejects duplicate title with 400', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id FROM courses WHERE LOWER(title)')) {
        return [[{ id: 1 }]]; // Existing course found
      }
      return [[]];
    };

    try {
      const req = {
        body: { title: 'HTML Basics' },
        user: { name: 'Owner' }
      };
      const res = createMockRes();

      await createCourse(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /already exists/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 4. UPDATE COURSE METADATA & TITLE CONFLICTS
  // ==========================================================================

  test('11. PUT /api/owner/courses/:id returns 404 if course does not exist', async () => {
    const originalExecute = pool.execute;
    pool.execute = async () => [[]];

    try {
      const req = { params: { id: 999 }, body: { title: 'Updated Title' } };
      const res = createMockRes();

      await updateCourse(req, res);

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /course not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('12. PUT /api/owner/courses/:id prevents renaming to another course title', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT * FROM courses WHERE id = ?')) {
        return [[{ id: 2, title: 'CSS Basics', difficulty: 'Beginner', status: 'published' }]];
      }
      if (sql.includes('SELECT id FROM courses WHERE LOWER(title) = LOWER(?) AND id != ?')) {
        return [[{ id: 1 }]]; // Another course already has this title
      }
      return [[]];
    };

    try {
      const req = { params: { id: 2 }, body: { title: 'HTML Basics' } };
      const res = createMockRes();

      await updateCourse(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /another course with this title already exists/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('13. PUT /api/owner/courses/:id updates course successfully', async () => {
    const originalExecute = pool.execute;
    let updatedValues = [];

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT * FROM courses WHERE id = ?')) {
        return [[{ id: 4, title: 'React Basics', category: 'Frontend', difficulty: 'Intermediate', status: 'published' }]];
      }
      if (sql.includes('UPDATE courses SET')) {
        updatedValues = params;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: 4 },
        body: { description: 'Updated Description for React', difficulty: 'Advanced' }
      };
      const res = createMockRes();

      await updateCourse(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.course.difficulty, 'Advanced');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 5. STATUS TOGGLE (PUBLISH / UNPUBLISH)
  // ==========================================================================

  test('14. PATCH /api/owner/courses/:id/status updates status to "draft" or "published"', async () => {
    const originalExecute = pool.execute;
    let updatedStatus = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, status FROM courses WHERE id = ?')) {
        return [[{ id: 5, title: 'Node.js Basics', status: 'published' }]];
      }
      if (sql.includes('UPDATE courses SET status = ? WHERE id = ?')) {
        updatedStatus = params[0];
        return [{ affectedRows: 1 }];
      }
      return [[]];
    };

    try {
      const req = { params: { id: 5 }, body: { status: 'draft' } };
      const res = createMockRes();

      await updateCourseStatus(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'draft');
      assert.equal(updatedStatus, 'draft');
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('15. PATCH /api/owner/courses/:id/status rejects invalid status with 400', async () => {
    const req = { params: { id: 5 }, body: { status: 'invalid_status' } };
    const res = createMockRes();

    await updateCourseStatus(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /allowed values/i);
  });

  // ==========================================================================
  // 6. SAFE DELETION GUARDS
  // ==========================================================================

  test('16. DELETE /api/owner/courses/:id blocks deletion if active enrollments exist', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, title FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'HTML Basics' }]];
      }
      if (sql.includes('SELECT COUNT(*) as enrollCount FROM enrollments')) {
        return [[{ enrollCount: 4 }]]; // 4 enrolled students
      }
      return [[]];
    };

    try {
      const req = { params: { id: 1 } };
      const res = createMockRes();

      await deleteCourse(req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /cannot delete course with active student enrollments/i);
      assert.match(res.body.message, /unpublish the course instead/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('17. DELETE /api/owner/courses/:id deletes course safely when enrollments = 0', async () => {
    const originalExecute = pool.execute;
    let deletedId = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title FROM courses WHERE id = ?')) {
        return [[{ id: 99, title: 'Unused Draft Course' }]];
      }
      if (sql.includes('SELECT COUNT(*) as enrollCount FROM enrollments')) {
        return [[{ enrollCount: 0 }]];
      }
      if (sql.includes('DELETE FROM courses WHERE id = ?')) {
        deletedId = params[0];
        return [{ affectedRows: 1 }];
      }
      return [[]];
    };

    try {
      const req = { params: { id: 99 } };
      const res = createMockRes();

      await deleteCourse(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(deletedId, 99);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // ==========================================================================
  // 7. PUBLIC COURSE API BEHAVIOR (DRAFTS HIDDEN)
  // ==========================================================================

  test('18. Public course list (GET /api/courses) exposes only published courses', async () => {
    const originalExecute = pool.execute;
    let queryExecuted = '';

    pool.execute = async (sql) => {
      queryExecuted = sql;
      return [[
        { id: 1, title: 'HTML Basics', status: 'published' }
      ]];
    };

    try {
      const req = { user: null };
      const res = createMockRes();

      await getCourses(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(queryExecuted.includes("WHERE c.status = 'published'"));
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('19. Public course detail (GET /api/courses/:id) returns 404 for draft course', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM courses WHERE id = ?')) {
        return [[{ id: 15, title: 'Unpublished Draft Course', status: 'draft' }]];
      }
      return [[]];
    };

    try {
      const req = { params: { id: 15 }, user: null };
      const res = createMockRes();

      await getCourseById(req, res);

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /course not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('20. Public enrollment (POST /api/courses/:id/enroll) returns 404 for draft course', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, title, status FROM courses WHERE id = ?')) {
        return [[{ id: 15, title: 'Draft Course', status: 'draft' }]];
      }
      return [[]];
    };

    try {
      const req = { params: { id: 15 }, user: { id: 10 } };
      const res = createMockRes();

      await enrollCourse(req, res);

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /course not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test('21. Existing student enrolled course detail continues functioning normally', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM courses WHERE id = ?')) {
        return [[{ id: 1, title: 'HTML Basics', status: 'published' }]];
      }
      if (sql.includes('SELECT * FROM modules WHERE course_id = ?')) {
        return [[
          { id: 1, title: 'Module 1', order_index: 0 },
          { id: 2, title: 'Module 2', order_index: 1 }
        ]];
      }
      if (sql.includes('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?')) {
        return [[{ id: 101 }]];
      }
      if (sql.includes('SELECT module_id FROM progress WHERE user_id = ?')) {
        return [[{ module_id: 1 }]];
      }
      return [[]];
    };

    try {
      const req = { params: { id: 1 }, user: { id: 5 } };
      const res = createMockRes();

      await getCourseById(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.course.is_enrolled, true);
      assert.equal(res.body.course.progress_percent, 50);
      assert.equal(res.body.course.completed_count, 1);
    } finally {
      pool.execute = originalExecute;
    }
  });
});
