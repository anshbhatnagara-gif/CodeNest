import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../config/db.js';
import { healthCheckHandler, app } from '../server.js';

// Helper to create mock response object
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    getHeader(key) {
      return this.headers[key.toLowerCase()];
    },
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

describe('Phase 9.2C: Database Health Probe Test Suite (/api/health)', () => {
  const originalQuery = pool.query;
  const originalEnv = { ...process.env };

  afterEach(() => {
    pool.query = originalQuery;
    process.env = { ...originalEnv };
  });

  // -------------------------------------------------------------------------
  // 1. Database Available (HTTP 200)
  // -------------------------------------------------------------------------
  it('1. Returns HTTP 200 with connected status and latency when database is reachable', async () => {
    let queriedSql = null;
    pool.query = async (sql) => {
      queriedSql = sql;
      return [[{ health_check: 1 }]];
    };

    const req = {};
    const res = createMockRes();

    await healthCheckHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'CodeNest Backend is running ✅');
    assert.equal(res.body.database, 'connected');
    assert.ok(typeof res.body.latency_ms === 'number');
    assert.ok(res.body.latency_ms >= 0);
    assert.ok(typeof res.body.timestamp === 'string');
    assert.ok(!isNaN(Date.parse(res.body.timestamp)));
    assert.equal(queriedSql, 'SELECT 1 AS health_check');
  });

  // -------------------------------------------------------------------------
  // 2. Database Unavailable (HTTP 503)
  // -------------------------------------------------------------------------
  it('2. Returns HTTP 503 with degraded status when database is disconnected or unreachable', async () => {
    pool.query = async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:3306');
      err.code = 'ECONNREFUSED';
      throw err;
    };

    const req = {};
    const res = createMockRes();

    await healthCheckHandler(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'Service Degraded');
    assert.equal(res.body.database, 'disconnected');
    assert.ok(typeof res.body.latency_ms === 'number');
    assert.ok(typeof res.body.timestamp === 'string');
  });

  // -------------------------------------------------------------------------
  // 3. Database Query Timeout (HTTP 503)
  // -------------------------------------------------------------------------
  it('3. Safely times out and returns HTTP 503 when database query exceeds timeout limit', async () => {
    // Configure very short timeout for fast deterministic test execution
    process.env.DB_HEALTH_TIMEOUT_MS = '50';

    pool.query = () => {
      // Return a hanging promise that takes longer than the timeout
      return new Promise((resolve) => setTimeout(resolve, 300));
    };

    const req = {};
    const res = createMockRes();

    await healthCheckHandler(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'Service Degraded');
    assert.equal(res.body.database, 'disconnected');
    assert.ok(res.body.latency_ms >= 40);
  });

  // -------------------------------------------------------------------------
  // 4. Information Disclosure Prevention (Zero Credentials or Leaks)
  // -------------------------------------------------------------------------
  it('4. Does not leak database credentials, internal error messages, or connection details in error responses', async () => {
    pool.query = async () => {
      const sensitiveErr = new Error('Access denied for user "codenest_admin"@"10.0.0.4" to database "prod_secrets" with password YES');
      sensitiveErr.sql = 'SELECT 1 AS health_check';
      sensitiveErr.host = 'gateway01.ap-south-1.prod.tidbcloud.com';
      sensitiveErr.user = '2Xz9A4bc.root';
      throw sensitiveErr;
    };

    const req = {};
    const res = createMockRes();

    await healthCheckHandler(req, res);

    assert.equal(res.statusCode, 503);
    const responseKeys = Object.keys(res.body).sort();
    assert.deepEqual(responseKeys, ['database', 'latency_ms', 'status', 'success', 'timestamp']);

    const responseString = JSON.stringify(res.body);
    assert.equal(responseString.includes('Access denied'), false);
    assert.equal(responseString.includes('codenest_admin'), false);
    assert.equal(responseString.includes('prod_secrets'), false);
    assert.equal(responseString.includes('gateway01'), false);
    assert.equal(responseString.includes('tidbcloud'), false);
    assert.equal(responseString.includes('password'), false);
    assert.equal(responseString.includes('SELECT 1'), false);
  });

  // -------------------------------------------------------------------------
  // 5. Existing Routes Remain Functional & App Exports
  // -------------------------------------------------------------------------
  it('5. Exports app and verifies existing route handlers remain mounted and functional', () => {
    assert.ok(app);
    assert.equal(typeof app.handle, 'function');

    // Verify /api/health is registered in the router stack
    const hasHealthRoute = app._router.stack.some(
      (layer) => layer.route && layer.route.path === '/api/health'
    );
    assert.equal(hasHealthRoute, true, '/api/health route must be mounted in Express router');

    // Verify key core routes remain mounted
    const mountedPrefixes = app._router.stack
      .filter((layer) => layer.regexp)
      .map((layer) => layer.regexp.toString());

    assert.ok(mountedPrefixes.some((p) => p.includes('courses')), 'courses routes must remain mounted');
    assert.ok(mountedPrefixes.some((p) => p.includes('notes')), 'notes routes must remain mounted');
    assert.ok(mountedPrefixes.some((p) => p.includes('auth')), 'auth routes must remain mounted');
  });
});

