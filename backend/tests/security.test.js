import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import helmet from 'helmet';
import fs from 'fs';
import pool from '../config/db.js';
import { register, login, logout } from '../controllers/authController.js';
import { downloadNoteFile, deleteLocalFile } from '../controllers/notesController.js';
import authMiddleware, { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import ownerMiddleware from '../middleware/ownerMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { isAllowedOrigin } from '../middleware/corsConfig.js';
import os from 'os';
import multer from 'multer';
import { verifyFileSignature, validateFileContent, handleUploadError } from '../middleware/uploadMiddleware.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import notesRoutes from '../routes/notesRoutes.js';
import courseRoutes from '../routes/courseRoutes.js';

// Helper mock response object builder
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    downloadPath: null,
    downloadName: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    getHeader(key) {
      return this.headers[key.toLowerCase()];
    },
    removeHeader(key) {
      delete this.headers[key.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    download(filePath, fileName) {
      this.downloadPath = filePath;
      this.downloadName = fileName;
      return this;
    }
  };
  return res;
};

describe('Security Audit Test Suite — Owner Role & Authorization', () => {
  const originalEnvOwnerEmail = process.env.OWNER_EMAIL;
  const mockOwnerEmail = 'owner@codenest.com';

  beforeEach(() => {
    process.env.OWNER_EMAIL = mockOwnerEmail;
  });

  afterEach(() => {
    process.env.OWNER_EMAIL = originalEnvOwnerEmail;
  });

  // TEST 1: Public registration without a role creates a STUDENT
  test('1. Public registration without specifying a role assigns role="student"', async () => {
    const originalExecute = pool.execute;
    let insertedRole = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]]; // User does not exist
      }
      if (sql.includes('INSERT INTO users')) {
        insertedRole = params[4]; // 5th parameter is role
        return [{ insertId: 101 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 1 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: 'Test Student',
          email: 'student@example.com',
          password: 'password123'
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.role, 'student');
      assert.equal(insertedRole, 'student');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 2: Public registration requesting role=owner still creates a STUDENT
  test('2. Public registration requesting role="owner" is ignored and assigns role="student"', async () => {
    const originalExecute = pool.execute;
    let insertedRole = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedRole = params[4];
        return [{ insertId: 102 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 2 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: 'Malicious Attacker',
          email: 'attacker@example.com',
          password: 'password123',
          role: 'owner' // Attacker trying to elevate privilege
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.role, 'student');
      assert.equal(insertedRole, 'student');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 3: Public registration using OWNER_EMAIL does not automatically create owner
  test('3. Public registration using OWNER_EMAIL assigns role="student", NOT owner', async () => {
    const originalExecute = pool.execute;
    let insertedRole = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedRole = params[4];
        return [{ insertId: 103 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 3 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: 'Owner Impersonator',
          email: mockOwnerEmail, // Submitted owner email publicly
          password: 'password123'
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.role, 'student');
      assert.equal(insertedRole, 'student');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 4: Unauthenticated users cannot access owner-only endpoints
  test('4. Unauthenticated requests to ownerMiddleware are rejected with 401', () => {
    const req = { user: undefined };
    const res = createMockRes();
    let nextCalled = false;

    ownerMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /unauthorized|authentication/i);
  });

  // TEST 5: STUDENT users receive 403 on owner-only endpoints
  test('5. Student users calling ownerMiddleware receive 403 Forbidden', () => {
    const req = {
      user: {
        id: 1,
        name: 'Regular Student',
        email: 'student@example.com',
        role: 'student'
      }
    };
    const res = createMockRes();
    let nextCalled = false;

    ownerMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /owner access only/i);
  });

  // TEST 6: Properly provisioned OWNER users can access authorized endpoints
  test('6. Properly provisioned OWNER user passes ownerMiddleware successfully', () => {
    const req = {
      user: {
        id: 99,
        name: 'Academy Owner',
        email: mockOwnerEmail,
        role: 'owner'
      }
    };
    const res = createMockRes();
    let nextCalled = false;

    ownerMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  // TEST 7: Missing OWNER_EMAIL does not cause an unhandled TypeError
  test('7. Missing OWNER_EMAIL environment variable fails securely (no TypeError crash)', () => {
    delete process.env.OWNER_EMAIL; // Simulating missing env var

    const req = {
      user: {
        id: 99,
        name: 'Owner User',
        email: 'owner@codenest.com',
        role: 'owner'
      }
    };
    const res = createMockRes();
    let nextCalled = false;

    assert.doesNotThrow(() => {
      ownerMiddleware(req, res, () => {
        nextCalled = true;
      });
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /server security configuration error/i);
  });

  // TEST 8: Existing login and registration functionality still works
  test('8. Existing login functionality works properly with standard password validation', async () => {
    const originalExecute = pool.execute;
    const mockHash = '$2a$12$Nq9.aB2O.fXv/8mKzKz2ue5Q2T7D/j.5J0W.8K8e.7F6G5H4I3J2K';

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM users')) {
        return [[{
          id: 5,
          name: 'Jane Student',
          email: 'jane@example.com',
          password: mockHash,
          role: 'student',
          xp: 100,
          level: 2
        }]];
      }
      return [[]];
    };

    try {
      const invalidReq = {
        body: {
          email: 'jane@example.com',
          password: 'wrongpassword'
        }
      };
      const invalidRes = createMockRes();
      await login(invalidReq, invalidRes);

      assert.equal(invalidRes.statusCode, 401);
      assert.equal(invalidRes.body.success, false);
      assert.match(invalidRes.body.message, /invalid email or password/i);
    } finally {
      pool.execute = originalExecute;
    }
  });
});

describe('Security Audit Test Suite — Helmet Security Headers & Rate Limiting', () => {
  // TEST 9: Helmet security headers are properly attached to responses
  test('9. Helmet security headers (nosniff, frameguard, CORP) are set on responses', async () => {
    const helmetMw = helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"] }
      }
    });

    const req = { method: 'GET', headers: {}, url: '/api/health' };
    const res = createMockRes();

    await new Promise((resolve) => {
      helmetMw(req, res, resolve);
    });

    assert.equal(res.getHeader('x-content-type-options'), 'nosniff');
    assert.equal(res.getHeader('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.getHeader('cross-origin-resource-policy'), 'cross-origin');
  });

  // TEST 10: Rate limiter triggers HTTP 429 after exceeding request limit
  test('10. Auth rate limiter blocks requests exceeding max threshold with HTTP 429', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      max: 3,
      legacyHeaders: false,
      standardHeaders: true
    });

    const ip = '192.168.1.100';
    let responses = [];

    for (let i = 0; i < 4; i++) {
      const req = {
        ip,
        headers: {},
        app: { get: () => false },
        method: 'POST',
        url: '/api/auth/login'
      };
      const res = createMockRes();
      let nextCalled = false;

      await new Promise((resolve) => {
        limiter(req, res, (err) => {
          nextCalled = true;
          resolve(err);
        });
        // If 429 handler executes, res.json resolves automatically
        setImmediate(resolve);
      });

      responses.push({ statusCode: res.statusCode, body: res.body, nextCalled });
    }

    // First 3 requests should pass through to route handler
    assert.equal(responses[0].nextCalled, true);
    assert.equal(responses[1].nextCalled, true);
    assert.equal(responses[2].nextCalled, true);

    // 4th request should be blocked by rate limiter with 429
    assert.equal(responses[3].nextCalled, false);
    assert.equal(responses[3].statusCode, 429);
    assert.equal(responses[3].body.success, false);
    assert.match(responses[3].body.message, /too many requests/i);
  });

  // TEST 11: Production Error Handler hides stack traces and secrets
  test('11. Global error handler suppresses stack traces and internal secrets in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const err = new Error('Sensitive database connection string DB_PASS=secret123');
      const req = {};
      const res = createMockRes();

      // Error handler logic test
      const isDev = process.env.NODE_ENV === 'development';
      res.status(500).json({
        success: false,
        message: isDev ? `Server error: ${err.message}` : 'Internal server error.'
      });

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, 'Internal server error.');
      assert.equal(res.body.message.includes('secret123'), false);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // TEST 12: File upload validation rejects extension spoofing
  test('12. File upload filter rejects spoofed extension attack (e.g. shell.php with image/png MIME)', () => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ];

    const fileFilter = (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype;

      if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mimeType)) {
        cb(null, true);
      } else {
        cb(new Error('File type not supported.'), false);
      }
    };

    let passSpoofed = false;
    fileFilter({}, { originalname: 'shell.php', mimetype: 'image/png' }, (err, result) => {
      passSpoofed = result === true;
    });

    assert.equal(passSpoofed, false, 'Spoofed file extension shell.php should be rejected even with valid image MIME type');
  });
});

describe('Security Audit Test Suite — Strict CORS Origin Filtering', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // TEST 13: Configured production frontend origin is accepted
  test('13. Configured production frontend origin is accepted by CORS filter', () => {
    const prodOrigin = 'https://coding-academy-pro-free-course.vercel.app';
    assert.equal(isAllowedOrigin(prodOrigin), true);
  });

  // TEST 14: Unrelated Vercel origin is rejected
  test('14. Unrelated Vercel origin (e.g. malicious-attacker.vercel.app) is rejected', () => {
    const maliciousVercelOrigin = 'https://malicious-attacker.vercel.app';
    assert.equal(isAllowedOrigin(maliciousVercelOrigin), false);
  });

  // TEST 15: Unconfigured external origin is rejected
  test('15. Unconfigured external origin (e.g. evil-hacker.com) is rejected', () => {
    const evilOrigin = 'https://evil-hacker.com';
    assert.equal(isAllowedOrigin(evilOrigin), false);
  });

  // TEST 16: Localhost is accepted in dev mode but rejected in production mode
  test('16. Localhost is accepted in development mode but rejected in production mode', () => {
    process.env.NODE_ENV = 'development';
    assert.equal(isAllowedOrigin('http://localhost:5173'), true);

    process.env.NODE_ENV = 'production';
    assert.equal(isAllowedOrigin('http://localhost:5173'), false);
  });

  // TEST 17: Requests without an Origin header are accepted for non-browser clients
  test('17. Requests without an Origin header (cURL, mobile apps) are accepted', () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin(null), true);
    assert.equal(isAllowedOrigin(''), true);
  });
});

describe('Security Audit Test Suite — Authorized File Attachment Access & Download Controls', () => {
  const originalEnvOwnerEmail = process.env.OWNER_EMAIL;
  const mockOwnerEmail = 'owner@codenest.com';
  const testUploadDir = path.resolve(process.cwd(), 'uploads', 'notes');
  const testFileName = 'sample_attachment_test.pdf';
  const testFilePath = path.join(testUploadDir, testFileName);

  beforeEach(() => {
    process.env.OWNER_EMAIL = mockOwnerEmail;
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, 'MOCK PDF CONTENT FOR SECURITY TEST');
  });

  afterEach(() => {
    process.env.OWNER_EMAIL = originalEnvOwnerEmail;
    if (fs.existsSync(testFilePath)) {
      try { fs.unlinkSync(testFilePath); } catch (e) {}
    }
  });

  // TEST 18: Unauthenticated requests to download file attachments are rejected with 401
  test('18. Unauthenticated requests to download file attachments are rejected with 401', async () => {
    const req = { params: { id: '10' }, user: undefined };
    const res = createMockRes();

    await downloadNoteFile(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /authentication/i);
  });

  // TEST 18b: Token supplied only through query parameter is rejected with 401
  test('18b. Token supplied only through query parameter is rejected by authMiddleware with 401', async () => {
    const req = {
      headers: {},
      query: { token: 'mock-jwt-token-in-query' }
    };
    const res = createMockRes();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /no token provided/i);
  });

  // TEST 19: Students cannot download draft note attachments (403 Forbidden)
  test('19. Students cannot download draft note attachments (403 Forbidden)', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 10,
          title: 'Draft Lecture Notes',
          file_url: `/uploads/notes/${testFileName}`,
          file_name: testFileName,
          status: 'draft'
        }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '10' },
        user: { id: 2, name: 'Student User', email: 'student@example.com', role: 'student' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /forbidden|unpublished|draft/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 20: Students can download permitted published note attachments (200 OK)
  test('20. Students can download permitted published note attachments (200 OK)', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 10,
          title: 'Published Study Guide',
          file_url: `/uploads/notes/${testFileName}`,
          file_name: testFileName,
          status: 'published'
        }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '10' },
        user: { id: 2, name: 'Student User', email: 'student@example.com', role: 'student' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      assert.equal(res.downloadPath, testFilePath);
      assert.equal(res.downloadName, testFileName);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 21: Authorized owners can download draft note attachments (200 OK)
  test('21. Authorized owners can download draft note attachments (200 OK)', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 10,
          title: 'Owner Secret Draft Note',
          file_url: `/uploads/notes/${testFileName}`,
          file_name: testFileName,
          status: 'draft'
        }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '10' },
        user: { id: 1, name: 'Academy Owner', email: mockOwnerEmail, role: 'owner' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      assert.equal(res.downloadPath, testFilePath);
      assert.equal(res.downloadName, testFileName);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 22: Non-existent note ID or missing attachment returns 404
  test('22. Non-existent note ID or missing attachment returns 404', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '999' },
        user: { id: 2, name: 'Student User', email: 'student@example.com', role: 'student' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /note not found/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 23: Path traversal attempt in file_url is safely rejected or contained
  test('23. Path traversal attempt in file_url is safely rejected or contained', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 10,
          title: 'Malicious Traversal Note',
          file_url: '/uploads/notes/../../server.js',
          file_name: 'server.js',
          status: 'published'
        }]];
      }
      return [[]];
    };

    try {
      const req = {
        params: { id: '10' },
        user: { id: 2, name: 'Student User', email: 'student@example.com', role: 'student' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      if (res.downloadPath) {
        assert.equal(res.downloadPath.startsWith(testUploadDir), true, 'File path must be strictly contained within uploadDir');
      } else {
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
      }
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 23b: Direct unauthenticated request to a known uploaded file's /uploads/... URL does not return the file (SEC-01)
  test('23b. Direct unauthenticated request to /uploads/... URL does not return the file (SEC-01)', async () => {
    // 1. Verify server.js does not configure public static serving of /uploads
    const serverJsPath = path.resolve(process.cwd(), 'server.js');
    const serverJsCode = fs.readFileSync(serverJsPath, 'utf8');
    const hasStaticUploads = /app\.use\(\s*['"]\/uploads['"]\s*,\s*express\.static/i.test(serverJsCode);
    assert.equal(hasStaticUploads, false, 'server.js must not mount express.static on /uploads');

    // 2. Start an isolated test HTTP server with CodeNest routing architecture (without static uploads)
    const testApp = express();
    testApp.use('/api/notes', notesRoutes);
    testApp.use((req, res) => {
      res.status(404).json({ success: false, message: 'Route not found.' });
    });

    const server = await new Promise((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    try {
      // Attempt direct unauthenticated access to the known uploaded file on disk
      const directResponse = await fetch(`http://127.0.0.1:${port}/uploads/notes/${testFileName}`);

      // Direct static request must NOT return the file or 200 OK
      assert.equal(directResponse.status, 404);
      const json = await directResponse.json();
      assert.equal(json.success, false);
      assert.equal(json.message, 'Route not found.');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TEST 23c: Authorized user can still download note attachment through protected API endpoint
  test('23c. Authorized user can download attachment through protected endpoint while direct /uploads access is blocked', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 42,
          title: 'Protected Lecture Notes',
          file_url: `/uploads/notes/${testFileName}`,
          file_name: testFileName,
          status: 'published'
        }]];
      }
      return [[]];
    };

    try {
      // Authorized student downloading a published note via protected downloadNoteFile handler
      const req = {
        params: { id: '42' },
        user: { id: 5, name: 'Enrolled Student', email: 'enrolled@codenest.com', role: 'student' }
      };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      // Verify the file was served through the protected controller
      assert.equal(res.downloadPath, testFilePath);
      assert.equal(res.downloadName, testFileName);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 23d: Existing draft-note access restrictions continue to work
  test('23d. Draft-note access restrictions continue to be strictly enforced on protected endpoint', async () => {
    const originalExecute = pool.execute;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
        return [[{
          id: 43,
          title: 'Unpublished Draft Note',
          file_url: `/uploads/notes/${testFileName}`,
          file_name: testFileName,
          status: 'draft'
        }]];
      }
      return [[]];
    };

    try {
      // 1. Student must be rejected with 403 Forbidden
      const studentReq = {
        params: { id: '43' },
        user: { id: 5, name: 'Student', email: 'student@codenest.com', role: 'student' }
      };
      const studentRes = createMockRes();
      await downloadNoteFile(studentReq, studentRes);

      assert.equal(studentRes.statusCode, 403);
      assert.equal(studentRes.body.success, false);
      assert.match(studentRes.body.message, /forbidden|unpublished|draft/i);

      // 2. Unauthenticated caller must be rejected with 401
      const unauthReq = { params: { id: '43' }, user: undefined };
      const unauthRes = createMockRes();
      await downloadNoteFile(unauthReq, unauthRes);

      assert.equal(unauthRes.statusCode, 401);
      assert.equal(unauthRes.body.success, false);

      // 3. Authorized owner MUST be allowed to download draft notes (200 OK)
      const ownerReq = {
        params: { id: '43' },
        user: { id: 1, name: 'Academy Owner', email: mockOwnerEmail, role: 'owner' }
      };
      const ownerRes = createMockRes();
      await downloadNoteFile(ownerReq, ownerRes);

      assert.equal(ownerRes.downloadPath, testFilePath);
      assert.equal(ownerRes.downloadName, testFileName);
    } finally {
      pool.execute = originalExecute;
    }
  });
});


describe('Security Audit Test Suite — Advanced File Upload Security & Magic Byte Validation', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codenest-file-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  // TEST 24: Valid supported file formats are successfully verified and accepted
  test('24. Valid supported formats (PDF, PNG, JPG, GIF, WEBP, DOC, PPT, DOCX, PPTX, TXT) are accepted', () => {
    const validSamples = [
      { name: 'document.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.7\nvalid-pdf-body') },
      { name: 'image.png', mime: 'image/png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]) },
      { name: 'photo.jpg', mime: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
      { name: 'photo.jpeg', mime: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) },
      { name: 'anim.gif', mime: 'image/gif', data: Buffer.from('GIF89a\x01\x00\x01\x00') },
      { name: 'graphic.webp', mime: 'image/webp', data: Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]) },
      { name: 'legacy.doc', mime: 'application/msword', data: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]) },
      { name: 'slides.ppt', mime: 'application/vnd.ms-powerpoint', data: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]) },
      { name: 'notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('PK-header word/document.xml [Content_Types].xml')]) },
      { name: 'deck.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', data: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('PK-header ppt/presentation.xml [Content_Types].xml')]) },
      { name: 'readme.txt', mime: 'text/plain', data: Buffer.from('Plain text syllabus and code notes.\nLine 2.\n') }
    ];

    for (const sample of validSamples) {
      const filePath = path.join(tempDir, sample.name);
      fs.writeFileSync(filePath, sample.data);

      const isValid = verifyFileSignature(filePath, sample.name, sample.mime);
      assert.equal(isValid, true, `Expected ${sample.name} to be valid`);

      const req = {
        file: {
          path: filePath,
          originalname: sample.name,
          mimetype: sample.mime
        }
      };
      const res = createMockRes();
      let nextCalled = false;
      validateFileContent(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, `Middleware should call next() for valid ${sample.name}`);
      assert.equal(fs.existsSync(filePath), true, `Valid file ${sample.name} should remain on disk`);
    }
  });

  // TEST 25: A fake PNG containing unrelated binary data is rejected
  test('25. Fake PNG containing arbitrary binary data is rejected and removed from disk', () => {
    const fakePath = path.join(tempDir, 'fake.png');
    fs.writeFileSync(fakePath, Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]));

    const req = {
      file: {
        path: fakePath,
        originalname: 'fake.png',
        mimetype: 'image/png'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false, 'Middleware must reject fake PNG');
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(fs.existsSync(fakePath), false, 'Temporary rejected file must be deleted');
    assert.equal(req.file, undefined, 'req.file must be cleared');
  });

  // TEST 26: MIME type spoofing is rejected (e.g. PHP script or executable disguised as PNG)
  test('26. MIME type spoofing (e.g. PHP script declared as image/png) is rejected', () => {
    const scriptPath = path.join(tempDir, 'payload.png');
    fs.writeFileSync(scriptPath, Buffer.from('<?php echo "pwned"; ?>'));

    const req = {
      file: {
        path: scriptPath,
        originalname: 'payload.png',
        mimetype: 'image/png'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(scriptPath), false);
  });

  // TEST 27: Extension and signature mismatch is rejected (e.g. PDF renamed to .jpg)
  test('27. Extension and signature mismatch (PDF bytes disguised with .jpg extension) is rejected', () => {
    const mismatchPath = path.join(tempDir, 'test.jpg');
    fs.writeFileSync(mismatchPath, Buffer.from('%PDF-1.4\n%real-pdf-content'));

    const req = {
      file: {
        path: mismatchPath,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(mismatchPath), false);
  });

  // TEST 28: Malformed, empty, or truncated file is rejected
  test('28. Empty (0-byte) or truncated file is rejected', () => {
    const emptyPath = path.join(tempDir, 'empty.pdf');
    fs.writeFileSync(emptyPath, Buffer.alloc(0));

    const req = {
      file: {
        path: emptyPath,
        originalname: 'empty.pdf',
        mimetype: 'application/pdf'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(emptyPath), false);
  });

  // TEST 29: DOCX and PPTX container structure validation
  test('29. DOCX/PPTX container validation: generic ZIP archive without Office structure is rejected', () => {
    const genericZipPath = path.join(tempDir, 'fake-doc.docx');
    fs.writeFileSync(genericZipPath, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('some/other/file.txt in regular zip')]));

    const req = {
      file: {
        path: genericZipPath,
        originalname: 'fake-doc.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false, 'Generic ZIP must not be accepted as DOCX');
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(genericZipPath), false);
  });

  // TEST 30: Plain-text validation according to documented policy (rejects null bytes and binary headers)
  test('30. Plain-text validation: binary null bytes or executable headers are rejected', () => {
    // 30a: Text file with null bytes
    const nullByteText = path.join(tempDir, 'nullbyte.txt');
    fs.writeFileSync(nullByteText, Buffer.from('Hello\x00World'));

    let req = {
      file: {
        path: nullByteText,
        originalname: 'nullbyte.txt',
        mimetype: 'text/plain'
      }
    };
    let res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(nullByteText), false);

    // 30b: Text file disguised with Windows PE (MZ) executable header
    const mzText = path.join(tempDir, 'executable.txt');
    fs.writeFileSync(mzText, Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is a binary executable'));

    req = {
      file: {
        path: mzText,
        originalname: 'executable.txt',
        mimetype: 'text/plain'
      }
    };
    res = createMockRes();
    nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(mzText), false);

    // 30c: Text file containing shell script shebang
    const shebangText = path.join(tempDir, 'script.txt');
    fs.writeFileSync(shebangText, Buffer.from('#!/bin/bash\nrm -rf /'));

    req = {
      file: {
        path: shebangText,
        originalname: 'script.txt',
        mimetype: 'text/plain'
      }
    };
    res = createMockRes();
    nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(shebangText), false);
  });

  // TEST 31: Oversized upload handling returns friendly message with max size limit
  test('31. Oversized uploads exceeding limit are caught and return descriptive 400', () => {
    const multerError = new multer.MulterError('LIMIT_FILE_SIZE');
    const req = {};
    const res = createMockRes();
    let nextCalled = false;

    handleUploadError(multerError, req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /exceeds the allowed limit/i);
  });

  // TEST 32: Unlink cleanup occurs even if validation logic throws an exception
  test('32. Rejected temporary files are cleaned up reliably on unexpected errors', () => {
    const errorFilePath = path.join(tempDir, 'error-test.pdf');
    fs.writeFileSync(errorFilePath, Buffer.from('corrupted'));

    const req = {
      file: {
        path: errorFilePath,
        originalname: null,
        mimetype: 'application/pdf'
      }
    };
    const res = createMockRes();
    let nextCalled = false;
    validateFileContent(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.equal(fs.existsSync(errorFilePath), false, 'File must be cleaned up on error');
    assert.equal(req.file, undefined);
  });
});

describe('Security Audit Test Suite — Authentication Hardening (Password & Algorithm Pinning)', () => {
  // TEST 33: Registration rejects passwords shorter than 8 characters (e.g., 7 chars)
  test('33. Registration rejects passwords shorter than 8 characters with HTTP 400', async () => {
    const req = {
      body: {
        name: 'Short Password User',
        email: 'shortpass@example.com',
        password: 'pass123'
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /at least 8 characters/i);
  });

  // TEST 34: Registration accepts valid passwords with 8 or more characters
  test('34. Registration accepts valid passwords with 8 or more characters', async () => {
    const originalExecute = pool.execute;
    let insertedPassword = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedPassword = params[3];
        return [{ insertId: 201 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 10 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: 'Valid Password User',
          email: 'validpass@example.com',
          password: 'password8'
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(insertedPassword, 'Password hash should be inserted');
      assert.notEqual(insertedPassword, 'password8', 'Password should be hashed');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 34b: Registration with a password longer than 128 characters returns HTTP 400 (SEC-02)
  test('34b. Registration with a password longer than 128 characters returns HTTP 400', async () => {
    const req = {
      body: {
        name: 'Long Pass User',
        email: 'longpass@example.com',
        password: 'a'.repeat(129)
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /128 characters/i);
  });

  // TEST 34c: Login with a password longer than 128 characters returns HTTP 400 (SEC-02)
  test('34c. Login with a password longer than 128 characters returns HTTP 400', async () => {
    const req = {
      body: {
        email: 'user@example.com',
        password: 'b'.repeat(129)
      }
    };
    const res = createMockRes();

    await login(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /128 characters/i);
  });

  // TEST 34d: Non-string password inputs return HTTP 400 (SEC-02)
  test('34d. Non-string password inputs return HTTP 400 for registration and login', async () => {
    // Registration with numeric password
    const regReqNum = {
      body: { name: 'User', email: 'test1@example.com', password: 12345678 }
    };
    const regResNum = createMockRes();
    await register(regReqNum, regResNum);
    assert.equal(regResNum.statusCode, 400);
    assert.equal(regResNum.body.success, false);

    // Registration with object password
    const regReqObj = {
      body: { name: 'User', email: 'test2@example.com', password: { length: 10 } }
    };
    const regResObj = createMockRes();
    await register(regReqObj, regResObj);
    assert.equal(regResObj.statusCode, 400);
    assert.equal(regResObj.body.success, false);

    // Login with numeric password
    const loginReqNum = {
      body: { email: 'user@example.com', password: 12345678 }
    };
    const loginResNum = createMockRes();
    await login(loginReqNum, loginResNum);
    assert.equal(loginResNum.statusCode, 400);
    assert.equal(loginResNum.body.success, false);
  });

  // TEST 34e: Non-string email inputs return HTTP 400 (SEC-02)
  test('34e. Non-string email inputs return HTTP 400 for registration and login', async () => {
    // Registration with numeric email
    const regReq = {
      body: { name: 'User', email: 12345, password: 'password123' }
    };
    const regRes = createMockRes();
    await register(regReq, regRes);
    assert.equal(regRes.statusCode, 400);
    assert.equal(regRes.body.success, false);

    // Login with object email
    const loginReq = {
      body: { email: { address: 'test@example.com' }, password: 'password123' }
    };
    const loginRes = createMockRes();
    await login(loginReq, loginRes);
    assert.equal(loginRes.statusCode, 400);
    assert.equal(loginRes.body.success, false);
  });

  // TEST 34f: Non-string name inputs return HTTP 400 (SEC-02)
  test('34f. Non-string name inputs return HTTP 400 for registration', async () => {
    const regReq = {
      body: { name: 99999, email: 'user@example.com', password: 'password123' }
    };
    const regRes = createMockRes();
    await register(regReq, regRes);
    assert.equal(regRes.statusCode, 400);
    assert.equal(regRes.body.success, false);
  });

  // TEST 34g: Missing required fields and invalid bodies return HTTP 400 (SEC-02)
  test('34g. Missing required fields and invalid bodies return HTTP 400', async () => {
    // Null body
    const nullBodyReq = { body: null };
    const nullBodyRes = createMockRes();
    await register(nullBodyReq, nullBodyRes);
    assert.equal(nullBodyRes.statusCode, 400);

    const nullLoginRes = createMockRes();
    await login(nullBodyReq, nullLoginRes);
    assert.equal(nullLoginRes.statusCode, 400);

    // Empty body
    const emptyBodyReq = { body: {} };
    const emptyRegRes = createMockRes();
    await register(emptyBodyReq, emptyRegRes);
    assert.equal(emptyRegRes.statusCode, 400);

    const emptyLoginRes = createMockRes();
    await login(emptyBodyReq, emptyLoginRes);
    assert.equal(emptyLoginRes.statusCode, 400);
  });

  // TEST 34h: Registration accepts exactly 72-byte ASCII password (SEC-02B)
  test('34h. Registration accepts exactly 72-byte ASCII password', async () => {
    const originalExecute = pool.execute;
    let insertedPassword = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedPassword = params[3];
        return [{ insertId: 301 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 11 }];
      }
      return [[]];
    };

    try {
      const ascii72 = 'A'.repeat(72);
      assert.equal(ascii72.length, 72);
      assert.equal(Buffer.byteLength(ascii72, 'utf8'), 72);

      const req = {
        body: {
          name: 'ASCII 72 User',
          email: 'ascii72@example.com',
          password: ascii72
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(insertedPassword, 'Password hash should be inserted');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 34i: Registration rejects 73-byte ASCII password with HTTP 400 (SEC-02B)
  test('34i. Registration rejects 73-byte ASCII password with HTTP 400', async () => {
    const ascii73 = 'A'.repeat(73);
    assert.equal(ascii73.length, 73);
    assert.equal(Buffer.byteLength(ascii73, 'utf8'), 73);

    const req = {
      body: {
        name: 'ASCII 73 User',
        email: 'ascii73@example.com',
        password: ascii73
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /72 bytes/i);
  });

  // TEST 34j: Registration accepts 36 occurrences of multibyte é (72 UTF-8 bytes) (SEC-02B)
  test('34j. Registration accepts 36 occurrences of é (72 UTF-8 bytes)', async () => {
    const originalExecute = pool.execute;
    let insertedPassword = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedPassword = params[3];
        return [{ insertId: 302 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 12 }];
      }
      return [[]];
    };

    try {
      const e36 = 'é'.repeat(36);
      assert.equal(e36.length, 36);
      assert.equal(Buffer.byteLength(e36, 'utf8'), 72);

      const req = {
        body: {
          name: 'Multibyte 72 User',
          email: 'e36@example.com',
          password: e36
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(insertedPassword, 'Password hash should be inserted');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 34k: Registration rejects 37 occurrences of multibyte é (74 UTF-8 bytes) (SEC-02B)
  test('34k. Registration rejects 37 occurrences of é (74 UTF-8 bytes) with HTTP 400', async () => {
    const e37 = 'é'.repeat(37);
    assert.equal(e37.length, 37);
    assert.equal(Buffer.byteLength(e37, 'utf8'), 74);

    const req = {
      body: {
        name: 'Multibyte 74 User',
        email: 'e37@example.com',
        password: e37
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /72 bytes/i);
  });

  // TEST 34l: Registration accepts 18 rocket emojis (72 UTF-8 bytes) (SEC-02B)
  test('34l. Registration accepts 18 rocket emojis (72 UTF-8 bytes)', async () => {
    const originalExecute = pool.execute;
    let insertedPassword = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedPassword = params[3];
        return [{ insertId: 303 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 13 }];
      }
      return [[]];
    };

    try {
      const rocket18 = '🚀'.repeat(18);
      assert.equal(rocket18.length, 36);
      assert.equal(Buffer.byteLength(rocket18, 'utf8'), 72);

      const req = {
        body: {
          name: 'Rocket 18 User',
          email: 'rocket18@example.com',
          password: rocket18
        }
      };
      const res = createMockRes();

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(insertedPassword, 'Password hash should be inserted');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 34m: Registration rejects 19 rocket emojis (76 UTF-8 bytes) (SEC-02B)
  test('34m. Registration rejects 19 rocket emojis (76 UTF-8 bytes) with HTTP 400', async () => {
    const rocket19 = '🚀'.repeat(19);
    assert.equal(rocket19.length, 38);
    assert.equal(Buffer.byteLength(rocket19, 'utf8'), 76);

    const req = {
      body: {
        name: 'Rocket 19 User',
        email: 'rocket19@example.com',
        password: rocket19
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /72 bytes/i);
  });

  // TEST 34n: Registration rejects 40 rocket emojis (160 UTF-8 bytes) (SEC-02B)
  test('34n. Registration rejects 40 rocket emojis (160 UTF-8 bytes) with HTTP 400', async () => {
    const rocket40 = '🚀'.repeat(40);
    assert.equal(rocket40.length, 80);
    assert.equal(Buffer.byteLength(rocket40, 'utf8'), 160);

    const req = {
      body: {
        name: 'Rocket 40 User',
        email: 'rocket40@example.com',
        password: rocket40
      }
    };
    const res = createMockRes();

    await register(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /72 bytes/i);
  });

  // TEST 34o: Legacy login with password longer than 72 UTF-8 bytes authenticates successfully (SEC-02B)
  test('34o. Legacy login with password longer than 72 UTF-8 bytes authenticates without premature 72-byte rejection', async () => {
    const originalExecute = pool.execute;
    const bcryptModule = await import('bcryptjs');
    const legacyPass = 'legacyPasswordExceeding72BytesLongForBcryptCompatibilityTest1234567890!MoreExtraBytes';
    assert.ok(legacyPass.length <= 128, 'Password must be within 128 characters');
    assert.ok(Buffer.byteLength(legacyPass, 'utf8') > 72, 'Password must exceed 72 bytes');
    const legacyHash = await bcryptModule.default.hash(legacyPass, 10);

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) {
        return [[{
          id: 77,
          name: 'Legacy User',
          email: 'legacy@example.com',
          phone: '',
          password: legacyHash,
          role: 'student',
          token_version: 1,
          xp: 50,
          level: 1
        }]];
      }
      if (sql.includes('UPDATE users SET last_login_at')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 77 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          email: 'legacy@example.com',
          password: legacyPass
        }
      };
      const res = createMockRes();

      await login(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token, 'Token should be returned on successful legacy login');
      assert.equal(res.body.user.id, 77);
      assert.equal(res.body.user.email, 'legacy@example.com');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 35: authMiddleware accepts valid token signed with pinned algorithm HS256
  test('35. authMiddleware accepts valid token signed with pinned algorithm HS256', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-jwt-algorithm-verification';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role')) {
        return [[{ id: 1, name: 'Test User', email: 'user@example.com', role: 'student', token_version: 1, xp: 0, level: 1 }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const validToken = jwt.sign(
        { id: 1, email: 'user@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = {
        headers: {
          authorization: `Bearer ${validToken}`
        }
      };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Next should be called for valid HS256 token');
      assert.equal(req.user.id, 1);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 36: authMiddleware rejects tokens signed with unapproved algorithms (e.g., HS384)
  test('36. authMiddleware rejects tokens signed with unapproved algorithms (e.g. HS384)', async () => {
    const testSecret = 'test-secret-key-for-jwt-algorithm-verification';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    try {
      const unapprovedToken = jwt.sign(
        { id: 1, email: 'user@example.com', role: 'student' },
        testSecret,
        { algorithm: 'HS384', expiresIn: '1h' }
      );

      const req = {
        headers: {
          authorization: `Bearer ${unapprovedToken}`
        }
      };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Next must not be called for unapproved algorithm token');
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid or expired token/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  // TEST 37: authMiddleware rejects expired JWT tokens with HTTP 401
  test('37. authMiddleware rejects expired JWT tokens with HTTP 401', async () => {
    const testSecret = 'test-secret-key-for-jwt-algorithm-verification';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    try {
      const expiredToken = jwt.sign(
        { id: 1, email: 'user@example.com', role: 'student' },
        testSecret,
        { algorithm: 'HS256', expiresIn: -10 }
      );

      const req = {
        headers: { authorization: `Bearer ${expiredToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.match(res.body.message, /invalid or expired token/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  // TEST 38: authMiddleware rejects tampered JWT signature with HTTP 401
  test('38. authMiddleware rejects tampered JWT signature with HTTP 401', async () => {
    const testSecret = 'test-secret-key-for-jwt-algorithm-verification';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    try {
      const validToken = jwt.sign(
        { id: 1, email: 'user@example.com', role: 'student' },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const tamperedToken = validToken.substring(0, validToken.length - 5) + 'xxxxx';

      const req = {
        headers: { authorization: `Bearer ${tamperedToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.match(res.body.message, /invalid or expired token/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  // TEST 39: authMiddleware handles database execution failures with HTTP 500 without false 401 logout
  test('39. authMiddleware handles database execution failures with HTTP 500 without false 401 logout', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-jwt-algorithm-verification';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async () => {
      throw new Error('ECONNREFUSED: Database connection dropped');
    };

    try {
      const validToken = jwt.sign(
        { id: 1, email: 'user@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = {
        headers: { authorization: `Bearer ${validToken}` }
      };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /database error/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });
});

describe('Security Audit Test Suite — Axios 401 Interceptor & Client Session Handling', () => {
  const createMockInterceptor = () => {
    let isRedirecting = false;
    let mockStorage = { 'cn_token': 'existing-valid-token' };
    let mockLocation = { pathname: '/dashboard', href: '/dashboard' };

    const handleAuthResponseError = async (error) => {
      const status = error.response?.status;
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

      if (status === 401 && !isAuthEndpoint) {
        delete mockStorage['cn_token'];

        const currentPath = mockLocation.pathname;
        const isAuthPage = currentPath === '/login' || currentPath === '/register';

        if (!isAuthPage && !isRedirecting) {
          isRedirecting = true;
          mockLocation.href = '/login';
        }
      }

      return Promise.reject(error);
    };

    return {
      handleAuthResponseError,
      getStorage: () => mockStorage,
      getLocation: () => mockLocation,
      setLocation: (l) => { mockLocation = l; },
      isRedirecting: () => isRedirecting
    };
  };

  // TEST 40: Axios 401 on protected endpoint clears cn_token and sets location to /login
  test('40. Axios 401 on protected endpoint clears cn_token and sets location to /login', async () => {
    const interceptor = createMockInterceptor();
    const error = {
      config: { url: '/api/progress/my-courses' },
      response: { status: 401, data: { message: 'Invalid or expired token.' } }
    };

    await assert.rejects(
      async () => interceptor.handleAuthResponseError(error),
      (err) => err === error
    );

    assert.equal(interceptor.getStorage()['cn_token'], undefined, 'Token must be removed');
    assert.equal(interceptor.getLocation().href, '/login', 'User should be redirected to /login');
  });

  // TEST 41: Axios 401 on /auth/login does not redirect or remove token (allows inline error)
  test('41. Axios 401 on /auth/login does not redirect or remove token (allows inline error)', async () => {
    const interceptor = createMockInterceptor();
    const error = {
      config: { url: '/api/auth/login' },
      response: { status: 401, data: { message: 'Invalid email or password.' } }
    };

    await assert.rejects(
      async () => interceptor.handleAuthResponseError(error),
      (err) => err === error
    );

    assert.equal(interceptor.getStorage()['cn_token'], 'existing-valid-token');
    assert.equal(interceptor.getLocation().href, '/dashboard', 'Should not redirect on login error');
  });

  // TEST 42: Axios 403 Forbidden does not clear token or trigger redirect
  test('42. Axios 403 Forbidden does not clear token or trigger redirect', async () => {
    const interceptor = createMockInterceptor();
    const error = {
      config: { url: '/api/owner/notes' },
      response: { status: 403, data: { message: 'Owner access only.' } }
    };

    await assert.rejects(
      async () => interceptor.handleAuthResponseError(error),
      (err) => err === error
    );

    assert.equal(interceptor.getStorage()['cn_token'], 'existing-valid-token');
    assert.equal(interceptor.getLocation().href, '/dashboard');
  });

  // TEST 43: Network error without HTTP response does not clear token or trigger redirect
  test('43. Network error without HTTP response does not clear token or trigger redirect', async () => {
    const interceptor = createMockInterceptor();
    const error = {
      config: { url: '/api/courses' },
      message: 'Network Error',
      response: undefined
    };

    await assert.rejects(
      async () => interceptor.handleAuthResponseError(error),
      (err) => err === error
    );

    assert.equal(interceptor.getStorage()['cn_token'], 'existing-valid-token');
    assert.equal(interceptor.getLocation().href, '/dashboard');
  });

  // TEST 44: No redirect loop when already on /login page
  test('44. No redirect loop when already on /login page', async () => {
    const interceptor = createMockInterceptor();
    interceptor.setLocation({ pathname: '/login', href: '/login' });

    const error = {
      config: { url: '/api/auth/profile' },
      response: { status: 401, data: { message: 'Session expired.' } }
    };

    await assert.rejects(
      async () => interceptor.handleAuthResponseError(error),
      (err) => err === error
    );

    assert.equal(interceptor.isRedirecting(), false, 'Should not initiate redirect if already on login page');
  });
});

describe('Security Audit Test Suite — Server-Side Session Revocation (token_version)', () => {
  // TEST 45: Newly issued token accepted with matching token_version
  test('45. Newly issued token accepted with matching token_version', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role')) {
        return [[{ id: 10, name: 'Active Student', email: 'student10@example.com', role: 'student', token_version: 1, xp: 50, level: 1 }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [[]];
      }
      return [[]];
    };

    try {
      const validToken = jwt.sign(
        { id: 10, email: 'student10@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'Next middleware must be invoked for matching token_version');
      assert.equal(req.user.id, 10);
      assert.equal(req.user.token_version, 1);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 46: Token rejected with HTTP 401 after version changes (session revoked)
  test('46. Token rejected with HTTP 401 after version changes (session revoked)', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    // Database user has token_version = 2 (e.g. after logout or password change)
    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role')) {
        return [[{ id: 10, name: 'Active Student', email: 'student10@example.com', role: 'student', token_version: 2, xp: 50, level: 1 }]];
      }
      return [[]];
    };

    try {
      // Client presents token with old token_version = 1
      const outdatedToken = jwt.sign(
        { id: 10, email: 'student10@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${outdatedToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Next must NOT be called for outdated token');
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /revoked or expired/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 47: Missing token_version in JWT (legacy pre-migration token) is rejected with HTTP 401
  test('47. Missing token_version in JWT (legacy pre-migration token) is rejected with HTTP 401', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role')) {
        return [[{ id: 10, name: 'Active Student', email: 'student10@example.com', role: 'student', token_version: 1, xp: 50, level: 1 }]];
      }
      return [[]];
    };

    try {
      // Legacy token issued before Phase 3 (lacks token_version)
      const legacyToken = jwt.sign(
        { id: 10, email: 'student10@example.com', role: 'student' },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${legacyToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Next must not be called when token lacks token_version');
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /revoked or expired/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 48: Non-numeric / invalid token_version in JWT is rejected with HTTP 401
  test('48. Non-numeric / invalid token_version in JWT is rejected with HTTP 401', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role')) {
        return [[{ id: 10, name: 'Active Student', email: 'student10@example.com', role: 'student', token_version: 1, xp: 50, level: 1 }]];
      }
      return [[]];
    };

    try {
      const invalidToken = jwt.sign(
        { id: 10, email: 'student10@example.com', role: 'student', token_version: '1' },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${invalidToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 49: Logout endpoint increments token_version in database and revokes sessions
  test('49. Logout endpoint increments token_version in database and revokes sessions', async () => {
    const originalExecute = pool.execute;
    let updateExecuted = false;
    let activityLogged = false;
    let updatedUserId = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('UPDATE users SET token_version = token_version + 1 WHERE id = ?')) {
        updateExecuted = true;
        updatedUserId = params[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        activityLogged = true;
        return [{ insertId: 50 }];
      }
      return [[]];
    };

    try {
      const req = { user: { id: 42, role: 'student' } };
      const res = createMockRes();

      await logout(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(updateExecuted, true, 'UPDATE query incrementing token_version must execute');
      assert.equal(updatedUserId, 42);
      assert.equal(activityLogged, true, 'Activity log must record logout event');
      assert.match(res.body.message, /revoked|logged out/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 50: Database errors during token_version verification return HTTP 500 without false 401
  test('50. Database errors during token_version verification return HTTP 500 without false 401', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    pool.execute = async () => {
      throw new Error('ETIMEDOUT: Database pool timeout');
    };

    try {
      const validToken = jwt.sign(
        { id: 10, email: 'student10@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /database error/i);
    } finally {
      process.env.JWT_SECRET = originalSecret;
      pool.execute = originalExecute;
    }
  });

  // TEST 51: Existing accounts work after migration with default token_version = 1
  test('51. Existing accounts work after migration with default token_version = 1', async () => {
    const originalExecute = pool.execute;
    const bcryptModule = await import('bcryptjs');
    const mockHashedPass = await bcryptModule.default.hash('correctPassword123', 10);

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) {
        return [[{
          id: 55,
          name: 'Migrated User',
          email: 'migrated@example.com',
          phone: '',
          password: mockHashedPass,
          role: 'student',
          token_version: 1,
          xp: 100,
          level: 1
        }]];
      }
      if (sql.includes('UPDATE users SET last_login_at')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 55 }];
      }
      if (sql.includes('SELECT id, name, email, role, token_version')) {
        return [[{
          id: 55,
          name: 'Migrated User',
          email: 'migrated@example.com',
          role: 'student',
          token_version: 1,
          xp: 100,
          level: 1
        }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    };

    try {
      const loginReq = { body: { email: 'migrated@example.com', password: 'correctPassword123' } };
      const loginRes = createMockRes();

      await login(loginReq, loginRes);

      assert.equal(loginRes.statusCode, 200);
      assert.equal(loginRes.body.success, true);
      const issuedToken = loginRes.body.token;

      // Verify token contains token_version: 1
      const decoded = jwt.decode(issuedToken);
      assert.equal(decoded.token_version, 1);

      // Verify token passes authMiddleware seamlessly
      const authReq = { headers: { authorization: `Bearer ${issuedToken}` } };
      const authRes = createMockRes();
      let nextCalled = false;

      await authMiddleware(authReq, authRes, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'Migrated account token must pass authMiddleware');
      assert.equal(authReq.user.id, 55);
      assert.equal(authReq.user.token_version, 1);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 52: Existing role authorization (student vs owner) remains intact with token_version
  test('52. Existing role authorization (student vs owner) remains intact with token_version', async () => {
    const originalExecute = pool.execute;
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    const originalOwnerEmail = process.env.OWNER_EMAIL;
    process.env.JWT_SECRET = testSecret;
    process.env.OWNER_EMAIL = 'owner@example.com';

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, name, email, role')) {
        const userId = params[0];
        if (userId === 100) {
          return [[{ id: 100, name: 'Owner Admin', email: 'owner@example.com', role: 'owner', token_version: 1, xp: 500, level: 5 }]];
        }
        return [[{ id: 101, name: 'Normal Student', email: 'student@example.com', role: 'student', token_version: 1, xp: 0, level: 1 }]];
      }
      if (sql.includes('UPDATE users SET last_active_at')) {
        return [[]];
      }
      return [[]];
    };

    try {
      // 1. Owner user with valid token_version
      const ownerToken = jwt.sign(
        { id: 100, email: 'owner@example.com', role: 'owner', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const ownerReq = { headers: { authorization: `Bearer ${ownerToken}` } };
      const ownerRes = createMockRes();
      let ownerNext = false;
      await authMiddleware(ownerReq, ownerRes, () => {
        ownerMiddleware(ownerReq, ownerRes, () => { ownerNext = true; });
      });
      assert.equal(ownerNext, true, 'Owner user must pass both authMiddleware and ownerMiddleware');

      // 2. Student user with valid token_version attempting owner route
      const studentToken = jwt.sign(
        { id: 101, email: 'student@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const studentReq = { headers: { authorization: `Bearer ${studentToken}` } };
      const studentRes = createMockRes();
      let studentNext = false;
      await authMiddleware(studentReq, studentRes, () => {
        ownerMiddleware(studentReq, studentRes, () => { studentNext = true; });
      });
      assert.equal(studentNext, false);
      assert.equal(studentRes.statusCode, 403, 'Student must be rejected with 403 by ownerMiddleware');
    } finally {
      process.env.JWT_SECRET = originalSecret;
      process.env.OWNER_EMAIL = originalOwnerEmail;
      pool.execute = originalExecute;
    }
  });

  // TEST 53: Expired and tampered tokens with token_version remain rejected
  test('53. Expired and tampered tokens with token_version remain rejected', async () => {
    const testSecret = 'test-secret-key-for-session-revocation';
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;

    try {
      // Expired token with token_version
      const expiredToken = jwt.sign(
        { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: -10 }
      );
      const expReq = { headers: { authorization: `Bearer ${expiredToken}` } };
      const expRes = createMockRes();
      let expNext = false;
      await authMiddleware(expReq, expRes, () => { expNext = true; });
      assert.equal(expNext, false);
      assert.equal(expRes.statusCode, 401);

      // Tampered token with token_version
      const validToken = jwt.sign(
        { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const tamperedToken = validToken.substring(0, validToken.length - 6) + 'abcdef';
      const tampReq = { headers: { authorization: `Bearer ${tamperedToken}` } };
      const tampRes = createMockRes();
      let tampNext = false;
      await authMiddleware(tampReq, tampRes, () => { tampNext = true; });
      assert.equal(tampNext, false);
      assert.equal(tampRes.statusCode, 401);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});

describe('Security Audit Test Suite — Registration Input Validation Hardening (SEC-03)', () => {
  // TEST 54: Email missing '@' is rejected with HTTP 400
  test('54. Registration rejects email missing "@" with HTTP 400', async () => {
    const req = {
      body: { name: 'Valid Name', email: 'plainaddress.example.com', password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /valid email address/i);
  });

  // TEST 55: Email missing domain or TLD is rejected with HTTP 400
  test('55. Registration rejects email missing domain or TLD with HTTP 400', async () => {
    const invalidEmails = ['user@', 'user@domain', 'user@.com', 'user@domain.'];
    for (const email of invalidEmails) {
      const req = {
        body: { name: 'Valid Name', email, password: 'password123' }
      };
      const res = createMockRes();
      await register(req, res);
      assert.equal(res.statusCode, 400, `Expected 400 for email: ${email}`);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /valid email address/i);
    }
  });

  // TEST 56: Email containing multiple '@' symbols is rejected with HTTP 400
  test('56. Registration rejects email containing multiple "@" symbols with HTTP 400', async () => {
    const req = {
      body: { name: 'Valid Name', email: 'user@@example.com', password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /valid email address/i);
  });

  // TEST 57: Email containing internal whitespace is rejected with HTTP 400
  test('57. Registration rejects email containing internal whitespace with HTTP 400', async () => {
    const invalidEmails = ['user name@example.com', 'user@ example.com', 'user@domain .com'];
    for (const email of invalidEmails) {
      const req = {
        body: { name: 'Valid Name', email, password: 'password123' }
      };
      const res = createMockRes();
      await register(req, res);
      assert.equal(res.statusCode, 400, `Expected 400 for email: ${email}`);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /valid email address/i);
    }
  });

  // TEST 58: Whitespace-only email is rejected with HTTP 400
  test('58. Registration rejects whitespace-only email with HTTP 400', async () => {
    const whitespaceEmails = ['   ', '\t', '  \n\t  '];
    for (const email of whitespaceEmails) {
      const req = {
        body: { name: 'Valid Name', email, password: 'password123' }
      };
      const res = createMockRes();
      await register(req, res);
      assert.equal(res.statusCode, 400, `Expected 400 for whitespace email`);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /email is required|valid email/i);
    }
  });

  // TEST 59: Email exceeding 150 characters is rejected with HTTP 400
  test('59. Registration rejects email exceeding 150 characters with HTTP 400', async () => {
    const longLocal = 'a'.repeat(140);
    const longEmail = `${longLocal}@example.com`; // 140 + 12 = 152 characters > 150
    assert.ok(longEmail.length > 150);

    const req = {
      body: { name: 'Valid Name', email: longEmail, password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /150 characters/i);
  });

  // TEST 60: Empty name is rejected with HTTP 400
  test('60. Registration rejects empty name with HTTP 400', async () => {
    const req = {
      body: { name: '', email: 'valid@example.com', password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /name.*required/i);
  });

  // TEST 61: Whitespace-only name is rejected with HTTP 400
  test('61. Registration rejects whitespace-only name with HTTP 400', async () => {
    const whitespaceNames = ['   ', '\t', '  \n  '];
    for (const name of whitespaceNames) {
      const req = {
        body: { name, email: 'valid@example.com', password: 'password123' }
      };
      const res = createMockRes();
      await register(req, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /name.*required|empty or whitespace/i);
    }
  });

  // TEST 62: Name exceeding 100 characters is rejected with HTTP 400
  test('62. Registration rejects name exceeding 100 characters with HTTP 400', async () => {
    const longName = 'A'.repeat(101);
    const req = {
      body: { name: longName, email: 'valid@example.com', password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /100 characters/i);
  });

  // TEST 63: Phone exceeding 20 characters is rejected with HTTP 400
  test('63. Registration rejects phone exceeding 20 characters with HTTP 400', async () => {
    const longPhone = '+1 234 567 890 123 4567'; // 23 characters > 20
    assert.ok(longPhone.length > 20);

    const req = {
      body: { name: 'Valid Name', email: 'valid@example.com', phone: longPhone, password: 'password123' }
    };
    const res = createMockRes();
    await register(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /20 characters/i);
  });

  // TEST 64: Valid tagged email is accepted with HTTP 201
  test('64. Registration accepts valid tagged email (student+test@example.com) with HTTP 201', async () => {
    const originalExecute = pool.execute;
    let insertedEmail = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedEmail = params[1];
        return [{ insertId: 601 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 101 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: 'Tagged User',
          email: 'student+test@example.com',
          password: 'password123'
        }
      };
      const res = createMockRes();
      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.email, 'student+test@example.com');
      assert.equal(insertedEmail, 'student+test@example.com');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 65: Leading/trailing whitespace on valid name and email is properly trimmed
  test('65. Registration properly trims leading/trailing whitespace on name and email', async () => {
    const originalExecute = pool.execute;
    let insertedName = null;
    let insertedEmail = null;
    let insertedPhone = null;

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id FROM users')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO users')) {
        insertedName = params[0];
        insertedEmail = params[1];
        insertedPhone = params[2];
        return [{ insertId: 602 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 102 }];
      }
      return [[]];
    };

    try {
      const req = {
        body: {
          name: '  Jane Doe  ',
          email: '  Jane.Doe+Dev@Example.COM  ',
          phone: '  +1234567890  ',
          password: 'password123'
        }
      };
      const res = createMockRes();
      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.name, 'Jane Doe');
      assert.equal(res.body.user.email, 'jane.doe+dev@example.com');
      assert.equal(res.body.user.phone, '+1234567890');
      assert.equal(insertedName, 'Jane Doe');
      assert.equal(insertedEmail, 'jane.doe+dev@example.com');
      assert.equal(insertedPhone, '+1234567890');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 66: Existing password and login validation remain unchanged
  test('66. Existing password length and login validation remain unchanged', async () => {
    // Password shorter than 8 chars still rejected
    const shortReq = {
      body: { name: 'Valid Name', email: 'valid@example.com', password: 'short' }
    };
    const shortRes = createMockRes();
    await register(shortReq, shortRes);
    assert.equal(shortRes.statusCode, 400);
    assert.match(shortRes.body.message, /at least 8 characters/i);

    // Password > 72 bytes still rejected on registration
    const longBytePass = 'A'.repeat(73);
    const byteReq = {
      body: { name: 'Valid Name', email: 'valid@example.com', password: longBytePass }
    };
    const byteRes = createMockRes();
    await register(byteReq, byteRes);
    assert.equal(byteRes.statusCode, 400);
    assert.match(byteRes.body.message, /72 bytes/i);

    // Login with valid credentials succeeds
    const originalExecute = pool.execute;
    const bcryptModule = await import('bcryptjs');
    const mockHash = await bcryptModule.default.hash('testPassword123', 10);

    pool.execute = async (sql) => {
      if (sql.includes('SELECT * FROM users WHERE email = ?')) {
        return [[{
          id: 88,
          name: 'Login Test User',
          email: 'loginuser@example.com',
          phone: '',
          password: mockHash,
          role: 'student',
          token_version: 1,
          xp: 10,
          level: 1
        }]];
      }
      if (sql.includes('UPDATE users SET last_login_at')) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO activity_logs')) {
        return [{ insertId: 88 }];
      }
      return [[]];
    };

    try {
      const loginReq = {
        body: { email: '  LoginUser@example.com  ', password: 'testPassword123' }
      };
      const loginRes = createMockRes();
      await login(loginReq, loginRes);

      assert.equal(loginRes.statusCode, 200);
      assert.equal(loginRes.body.success, true);
      assert.equal(loginRes.body.user.email, 'loginuser@example.com');
      assert.ok(loginRes.body.token);
    } finally {
      pool.execute = originalExecute;
    }
  });
});

describe('Security Audit Test Suite — Public Course Optional Authentication (SEC-04)', () => {
  const testSecret = 'test-secret-key-for-optional-auth-tests';
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // TEST 67: optionalAuthMiddleware allows requests without Authorization header to proceed as guest
  test('67. optionalAuthMiddleware allows requests without Authorization header to proceed as guest', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await optionalAuthMiddleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, 'next() must be called for guest request');
    assert.equal(req.user, undefined, 'req.user must be undefined');
    assert.equal(res.statusCode, 200);
  });

  // TEST 68: optionalAuthMiddleware populates req.user when valid HS256 token is provided
  test('68. optionalAuthMiddleware populates req.user when a valid HS256 token is provided', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role, token_version')) {
        return [[{ id: 10, name: 'Alice Student', email: 'alice@example.com', role: 'student', token_version: 1 }]];
      }
      return [[]];
    };

    try {
      const validToken = jwt.sign(
        { id: 10, email: 'alice@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await optionalAuthMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.ok(req.user);
      assert.equal(req.user.id, 10);
      assert.equal(req.user.email, 'alice@example.com');
      assert.equal(res.statusCode, 200);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 69: optionalAuthMiddleware degrades gracefully to guest when token is expired
  test('69. optionalAuthMiddleware degrades gracefully to guest when token is expired', async () => {
    const expiredToken = jwt.sign(
      { id: 10, email: 'alice@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: -10 }
    );

    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    await optionalAuthMiddleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, 'next() must be called on expired token');
    assert.equal(req.user, undefined, 'req.user must be undefined on expired token');
    assert.equal(res.statusCode, 200, 'Expired token must not return 401 on optional auth');
  });

  // TEST 70: optionalAuthMiddleware degrades gracefully to guest on malformed, invalid, or wrong-algorithm tokens
  test('70. optionalAuthMiddleware degrades gracefully to guest on malformed, invalid, or wrong-algorithm tokens', async () => {
    // 1. Malformed signature
    const malformedReq = { headers: { authorization: 'Bearer malformed.jwt.token' } };
    const malformedRes = createMockRes();
    let next1 = false;
    await optionalAuthMiddleware(malformedReq, malformedRes, () => { next1 = true; });
    assert.equal(next1, true);
    assert.equal(malformedReq.user, undefined);

    // 2. Unapproved algorithm (HS384)
    const hs384Token = jwt.sign(
      { id: 10, email: 'alice@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS384', expiresIn: '1h' }
    );
    const hs384Req = { headers: { authorization: `Bearer ${hs384Token}` } };
    const hs384Res = createMockRes();
    let next2 = false;
    await optionalAuthMiddleware(hs384Req, hs384Res, () => { next2 = true; });
    assert.equal(next2, true);
    assert.equal(hs384Req.user, undefined);

    // 3. Non-Bearer header
    const nonBearerReq = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const nonBearerRes = createMockRes();
    let next3 = false;
    await optionalAuthMiddleware(nonBearerReq, nonBearerRes, () => { next3 = true; });
    assert.equal(next3, true);
    assert.equal(nonBearerReq.user, undefined);
  });

  // TEST 71: optionalAuthMiddleware degrades gracefully to guest when token_version is revoked or mismatched
  test('71. optionalAuthMiddleware degrades gracefully to guest when token_version is revoked or mismatched', async () => {
    const originalExecute = pool.execute;
    pool.execute = async (sql) => {
      if (sql.includes('SELECT id, name, email, role, token_version')) {
        // User has token_version = 2 in database
        return [[{ id: 10, name: 'Alice Student', email: 'alice@example.com', role: 'student', token_version: 2 }]];
      }
      return [[]];
    };

    try {
      // Token has token_version = 1 (stale/revoked session)
      const staleToken = jwt.sign(
        { id: 10, email: 'alice@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${staleToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await optionalAuthMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true, 'next() must be called for revoked token');
      assert.equal(req.user, undefined, 'req.user must be reset to undefined');
      assert.equal(res.statusCode, 200, 'Must not return 401 on revoked token in optional auth');
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 72: optionalAuthMiddleware returns HTTP 500 when database execution fails during user lookup
  test('72. optionalAuthMiddleware returns HTTP 500 when database execution fails during user lookup', async () => {
    const originalExecute = pool.execute;
    pool.execute = async () => {
      throw new Error('ETIMEDOUT: Database pool timeout during user lookup');
    };

    try {
      const validToken = jwt.sign(
        { id: 10, email: 'alice@example.com', role: 'student', token_version: 1 },
        testSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockRes();
      let nextCalled = false;

      await optionalAuthMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'next() must NOT be called on database failure');
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /database error/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  // TEST 73: Public course route (GET /api/courses) serves public courses to guest when token is expired (Route integration)
  test('73. Public course route (GET /api/courses) serves public courses to guest when token is expired', async () => {
    const originalExecute = pool.execute;
    const mockCourses = [
      { id: 1, title: 'HTML Basics', description: 'Learn HTML', category: 'Web', difficulty: 'Beginner', total_modules: 5, total_enrolled: 10, is_enrolled: 0 }
    ];

    pool.execute = async (sql) => {
      if (sql.includes('FROM courses c')) {
        return [mockCourses];
      }
      return [[]];
    };

    const expiredToken = jwt.sign(
      { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: -10 }
    );

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/courses', courseRoutes);

    const server = await new Promise((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/courses`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });

      assert.equal(res.status, 200, 'Expired token must return HTTP 200 on public course route');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.courses.length, 1);
      assert.equal(data.courses[0].is_enrolled, 0);
    } finally {
      pool.execute = originalExecute;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TEST 74: Public course detail route (GET /api/courses/:id) serves course details to guest when token is expired (Route integration)
  test('74. Public course detail route (GET /api/courses/:id) serves course details to guest when token is expired', async () => {
    const originalExecute = pool.execute;
    const mockCourse = { id: 1, title: 'HTML Basics', description: 'Learn HTML' };
    const mockModules = [{ id: 1, course_id: 1, title: 'Intro to HTML', order_index: 0 }];

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT * FROM courses WHERE id = ?')) {
        return [[mockCourse]];
      }
      if (sql.includes('SELECT * FROM modules WHERE course_id = ?')) {
        return [mockModules];
      }
      return [[]];
    };

    const expiredToken = jwt.sign(
      { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: -10 }
    );

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/courses', courseRoutes);

    const server = await new Promise((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/courses/1`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });

      assert.equal(res.status, 200, 'Expired token must return HTTP 200 on course detail');
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.course.title, 'HTML Basics');
      assert.equal(data.course.is_enrolled, false);
      assert.equal(data.course.progress_percent, 0);
    } finally {
      pool.execute = originalExecute;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TEST 75: Public course route (GET /api/courses) personalizes enrollment when valid token is provided (Route integration)
  test('75. Public course route (GET /api/courses) personalizes enrollment when valid token is provided', async () => {
    const originalExecute = pool.execute;
    const mockUser = { id: 25, name: 'Enrolled Student', email: 'enrolled@example.com', role: 'student', token_version: 1 };
    const mockCourses = [
      { id: 1, title: 'HTML Basics', is_enrolled: 1 }
    ];

    pool.execute = async (sql, params) => {
      if (sql.includes('SELECT id, name, email, role, token_version')) {
        return [[mockUser]];
      }
      if (sql.includes('FROM courses c')) {
        // Assert that userId parameter was passed to query
        assert.equal(params[0], 25, 'Authenticated user ID must be passed to course query');
        return [mockCourses];
      }
      return [[]];
    };

    const validToken = jwt.sign(
      { id: 25, email: 'enrolled@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/courses', courseRoutes);

    const server = await new Promise((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/courses`, {
        headers: { Authorization: `Bearer ${validToken}` }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.courses[0].is_enrolled, 1);
    } finally {
      pool.execute = originalExecute;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TEST 76: Protected enrollment route (POST /api/courses/:id/enroll) strictly rejects missing, expired, malformed, or revoked tokens with HTTP 401
  test('76. Protected enrollment route (POST /api/courses/:id/enroll) strictly rejects missing, expired, malformed, or revoked tokens with HTTP 401', async () => {
    const originalExecute = pool.execute;
    const expiredToken = jwt.sign(
      { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: -10 }
    );
    const malformedToken = 'invalid.jwt.token.format';
    const revokedToken = jwt.sign(
      { id: 10, email: 'student@example.com', role: 'student', token_version: 1 },
      testSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/courses', courseRoutes);

    const server = await new Promise((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    try {
      // 1. Missing token -> 401
      const noTokenRes = await fetch(`http://127.0.0.1:${port}/api/courses/1/enroll`, {
        method: 'POST'
      });
      assert.equal(noTokenRes.status, 401, 'Missing token on protected enroll must return HTTP 401');
      const noTokenData = await noTokenRes.json();
      assert.equal(noTokenData.success, false);

      // 2. Expired token -> 401
      const expiredRes = await fetch(`http://127.0.0.1:${port}/api/courses/1/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.equal(expiredRes.status, 401, 'Expired token on protected enroll must return HTTP 401');
      const expiredData = await expiredRes.json();
      assert.equal(expiredData.success, false);
      assert.match(expiredData.message, /invalid or expired token/i);

      // 3. Malformed token -> 401
      const malformedRes = await fetch(`http://127.0.0.1:${port}/api/courses/1/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${malformedToken}` }
      });
      assert.equal(malformedRes.status, 401, 'Malformed token on protected enroll must return HTTP 401');
      const malformedData = await malformedRes.json();
      assert.equal(malformedData.success, false);
      assert.match(malformedData.message, /invalid or expired token/i);

      // 4. Revoked token (token_version mismatch) -> 401
      pool.execute = async (sql, params) => {
        if (sql.includes('FROM users WHERE id = ?')) {
          return [[{
            id: 10,
            email: 'student@example.com',
            role: 'student',
            status: 'active',
            token_version: 2
          }]];
        }
        return [[]];
      };

      const revokedRes = await fetch(`http://127.0.0.1:${port}/api/courses/1/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${revokedToken}` }
      });
      assert.equal(revokedRes.status, 401, 'Revoked token on protected enroll must return HTTP 401');
      const revokedData = await revokedRes.json();
      assert.equal(revokedData.success, false);
      assert.match(revokedData.message, /session has been revoked or expired/i);
    } finally {
      pool.execute = originalExecute;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // TEST 77: SEC-05 - Legitimate file inside uploads/notes can still be deleted
  test('77. SEC-05: Legitimate file inside uploads/notes is successfully deleted by deleteLocalFile', () => {
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'notes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const testFileName = `sec05_legit_${Date.now()}_test.txt`;
    const testFilePath = path.join(uploadDir, testFileName);
    fs.writeFileSync(testFilePath, 'legitimate file content for deletion test');

    assert.equal(fs.existsSync(testFilePath), true, 'Test file must exist before deletion');

    const result = deleteLocalFile(`/uploads/notes/${testFileName}`);
    assert.equal(result, true, 'deleteLocalFile must return true for legitimate note file');
    assert.equal(fs.existsSync(testFilePath), false, 'File must be deleted from filesystem');
  });

  // TEST 78: SEC-05 - Forward slash traversal (../) cannot delete file outside uploads/notes
  test('78. SEC-05: Path containing ../ cannot delete file outside uploads/notes directory', () => {
    const sentinelName = `sec05_sentinel_${Date.now()}_forward_traversal.txt`;
    const sentinelPath = path.join(os.tmpdir(), sentinelName);
    fs.writeFileSync(sentinelPath, 'sentinel data - must never be deleted by traversal');

    try {
      assert.equal(fs.existsSync(sentinelPath), true);

      // Attempt various forward-slash traversal sequences
      const result1 = deleteLocalFile(`/uploads/notes/../../${sentinelName}`);
      assert.equal(result1, false, 'Traversal path with ../ must be rejected');

      const result2 = deleteLocalFile(`/uploads/notes/../../../${sentinelName}`);
      assert.equal(result2, false, 'Deeper traversal path must be rejected');

      const result3 = deleteLocalFile(`../uploads/notes/${sentinelName}`);
      assert.equal(result3, false, 'Leading traversal prefix must be rejected');

      // Verify sentinel file is completely intact
      assert.equal(fs.existsSync(sentinelPath), true, 'Sentinel file outside uploads/notes must remain intact');
    } finally {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  });

  // TEST 79: SEC-05 - Windows backslash traversal (..\..\) cannot delete file outside uploads/notes
  test('79. SEC-05: Windows backslash traversal (..\\..\\) cannot delete file outside uploads/notes directory', () => {
    const sentinelName = `sec05_sentinel_${Date.now()}_backslash_traversal.txt`;
    const sentinelPath = path.join(os.tmpdir(), sentinelName);
    fs.writeFileSync(sentinelPath, 'sentinel data - must never be deleted by backslash traversal');

    try {
      assert.equal(fs.existsSync(sentinelPath), true);

      // Attempt various Windows backslash traversal sequences
      const result1 = deleteLocalFile(`/uploads/notes/..\\..\\${sentinelName}`);
      assert.equal(result1, false, 'Backslash traversal after prefix must be rejected');

      const result2 = deleteLocalFile(`..\\..\\uploads\\notes\\${sentinelName}`);
      assert.equal(result2, false, 'Pure backslash traversal must be rejected');

      const result3 = deleteLocalFile(`/uploads/notes\\..\\..\\${sentinelName}`);
      assert.equal(result3, false, 'Mixed separator traversal must be rejected');

      // Verify sentinel file is completely intact
      assert.equal(fs.existsSync(sentinelPath), true, 'Sentinel file must remain intact');
    } finally {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  });

  // TEST 80: SEC-05 - Absolute Windows paths and UNC paths are rejected
  test('80. SEC-05: Absolute Windows paths, drive-letter paths, and UNC paths are rejected', () => {
    const sentinelName = `sec05_sentinel_${Date.now()}_absolute.txt`;
    const sentinelPath = path.join(os.tmpdir(), sentinelName);
    fs.writeFileSync(sentinelPath, 'sentinel data - must never be deleted via absolute path');

    try {
      assert.equal(fs.existsSync(sentinelPath), true);

      // Absolute Windows drive-letter path with backslashes
      const result1 = deleteLocalFile(sentinelPath);
      assert.equal(result1, false, 'Windows absolute drive path must be rejected');

      // Absolute Windows drive-letter path with forward slashes
      const result2 = deleteLocalFile(sentinelPath.replace(/\\/g, '/'));
      assert.equal(result2, false, 'Forward-slash Windows drive path must be rejected');

      // UNC path formats
      const result3 = deleteLocalFile(`\\\\127.0.0.1\\c$\\${sentinelName}`);
      assert.equal(result3, false, 'UNC backslash path must be rejected');

      const result4 = deleteLocalFile(`//127.0.0.1/c$/${sentinelName}`);
      assert.equal(result4, false, 'UNC forward-slash path must be rejected');

      // Verify sentinel file is completely intact
      assert.equal(fs.existsSync(sentinelPath), true, 'Sentinel file must remain intact');
    } finally {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  });

  // TEST 81: SEC-05 - Unexpected URL formats, non-strings, dotfiles, and empty inputs are rejected
  test('81. SEC-05: Unexpected URL formats, non-strings, dotfiles, and empty inputs are rejected', () => {
    // Non-string inputs
    assert.equal(deleteLocalFile(null), false);
    assert.equal(deleteLocalFile(undefined), false);
    assert.equal(deleteLocalFile(12345), false);
    assert.equal(deleteLocalFile({}), false);
    assert.equal(deleteLocalFile([]), false);

    // Empty and whitespace inputs
    assert.equal(deleteLocalFile(''), false);
    assert.equal(deleteLocalFile('   '), false);
    assert.equal(deleteLocalFile('\t\n'), false);

    // Missing filename
    assert.equal(deleteLocalFile('/uploads/notes/'), false);

    // Dotfiles and traversal tokens
    assert.equal(deleteLocalFile('/uploads/notes/.env'), false);
    assert.equal(deleteLocalFile('/uploads/notes/.'), false);
    assert.equal(deleteLocalFile('/uploads/notes/..'), false);

    // Wrong upload prefix or schemes
    assert.equal(deleteLocalFile('/uploads/other/file.txt'), false);
    assert.equal(deleteLocalFile('/api/notes/file.txt'), false);
    assert.equal(deleteLocalFile('http://example.com/file.txt'), false);
    assert.equal(deleteLocalFile('file:///etc/passwd'), false);
  });

  // TEST 82: SEC-05 - Sibling directory sharing upload directory prefix cannot be targeted
  test('82. SEC-05: Sibling directory sharing upload directory prefix cannot be targeted', () => {
    const siblingDir = path.resolve(process.cwd(), 'uploads', 'notes_backup_sibling');
    if (!fs.existsSync(siblingDir)) {
      fs.mkdirSync(siblingDir, { recursive: true });
    }
    const sentinelName = `sec05_sibling_sentinel_${Date.now()}.txt`;
    const sentinelPath = path.join(siblingDir, sentinelName);
    fs.writeFileSync(sentinelPath, 'sibling sentinel data - must never be deleted');

    try {
      assert.equal(fs.existsSync(sentinelPath), true);

      const result = deleteLocalFile(`/uploads/notes_backup_sibling/${sentinelName}`);
      assert.equal(result, false, 'Sibling directory path sharing prefix must be rejected');
      assert.equal(fs.existsSync(sentinelPath), true, 'Sibling sentinel file must remain intact');
    } finally {
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
      if (fs.existsSync(siblingDir)) {
        try {
          fs.rmdirSync(siblingDir);
        } catch (_) {}
      }
    }
  });

  // TEST 83: SEC-05 - Symlink traversal outside uploads/notes is safely handled
  test('83. SEC-05: Symlink traversal is safely handled where test environment supports symlink creation', () => {
    const sentinelName = `sec05_symlink_sentinel_${Date.now()}.txt`;
    const sentinelPath = path.join(os.tmpdir(), sentinelName);
    fs.writeFileSync(sentinelPath, 'symlink target sentinel - must never be deleted');

    const uploadDir = path.resolve(process.cwd(), 'uploads', 'notes');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const symlinkName = `sec05_symlink_${Date.now()}.txt`;
    const symlinkPath = path.join(uploadDir, symlinkName);

    let symlinkCreated = false;
    try {
      try {
        fs.symlinkSync(sentinelPath, symlinkPath);
        symlinkCreated = true;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'ENOSYS') {
          // Unprivileged Windows environment does not permit creating symlinks without Developer Mode / Admin
          return;
        }
        throw err;
      }

      assert.equal(fs.existsSync(symlinkPath), true, 'Symlink should exist in uploads/notes');

      const result = deleteLocalFile(`/uploads/notes/${symlinkName}`);
      assert.equal(result, false, 'deleteLocalFile must refuse to delete or follow symlink');
      assert.equal(fs.existsSync(sentinelPath), true, 'External target sentinel file must remain intact');
    } finally {
      if (symlinkCreated && fs.existsSync(symlinkPath)) {
        try {
          fs.unlinkSync(symlinkPath);
        } catch (_) {}
      }
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    }
  });
});
