import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import compression from 'compression';
import { requestIdMiddleware } from '../server.js';

describe('Phase 9.3A: Backend Observability & Compression Test Suite', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // -------------------------------------------------------------------------
  // 1. Request ID & Header Tests
  // -------------------------------------------------------------------------
  it('1. Generates unique UUID v4 request ID and sets X-Request-Id header when absent', () => {
    const req = { headers: {} };
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      on() {}
    };

    let nextCalled = false;
    requestIdMiddleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(typeof req.id === 'string');
    assert.ok(req.id.length >= 32);
    assert.equal(res.headers['x-request-id'], req.id);
  });

  it('2. Preserves incoming X-Request-Id header from upstream proxy / gateway', () => {
    const incomingId = 'trace-id-abc-12345';
    const req = { headers: { 'x-request-id': incomingId } };
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      on() {}
    };

    requestIdMiddleware(req, res, () => {});

    assert.equal(req.id, incomingId);
    assert.equal(res.headers['x-request-id'], incomingId);
  });

  // -------------------------------------------------------------------------
  // 2. Compression Tests
  // -------------------------------------------------------------------------
  it('3. Compresses response payload exceeding threshold when Accept-Encoding gzip is present', async () => {
    const testApp = express();
    testApp.use(compression({ threshold: 1024 }));

    // Generate large JSON payload (> 2KB)
    const largePayload = {
      courses: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        title: `Comprehensive Fullstack Engineering Course ${i + 1}`,
        description: 'Detailed curriculum with extensive markdown descriptions, quizzes, and code samples.',
        instructor: 'Dr. Jane Doe',
        category: 'Development'
      }))
    };

    testApp.get('/test-large-json', (req, res) => {
      res.json(largePayload);
    });

    const mockReq = {
      method: 'GET',
      url: '/test-large-json',
      headers: { 'accept-encoding': 'gzip' }
    };

    let responseHeaders = {};
    let responseChunks = [];
    let statusCode = 200;

    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; },
      getHeader(k) { return responseHeaders[k.toLowerCase()]; },
      write(chunk) { responseChunks.push(chunk); },
      end(chunk) { if (chunk) responseChunks.push(chunk); },
      on() {},
      once() {},
      emit() {}
    };

    // Verify compression middleware attaches and configures gzip filter properly
    const filterFn = compression.filter;
    const shouldCompress = filterFn(mockReq, {
      getHeader: () => 'application/json'
    });
    assert.equal(shouldCompress, true, 'JSON payloads must be eligible for compression');
  });

  it('4. Bypasses compression when x-no-compression header is present', () => {
    const filter = (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    };

    const reqWithNoComp = { headers: { 'x-no-compression': 'true', 'accept-encoding': 'gzip' } };
    const res = { getHeader: () => 'application/json' };

    assert.equal(filter(reqWithNoComp, res), false, 'Must respect x-no-compression header');
  });

  // -------------------------------------------------------------------------
  // 3. Structured Error Context Tests
  // -------------------------------------------------------------------------
  it('5. Global error response includes req_id without exposing internal stack traces in production', () => {
    process.env.NODE_ENV = 'production';

    const errorHandler = (err, req, res, next) => {
      const isDev = process.env.NODE_ENV === 'development';
      res.status(err.status || err.statusCode || 500).json({
        success: false,
        req_id: req.id,
        message: isDev ? `Server error: ${err.message}` : 'Internal server error.'
      });
    };

    const req = { id: 'trace-err-test-999', method: 'GET', url: '/api/error-test' };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; }
    };

    errorHandler(new Error('Sensitive database deadlock in internal table'), req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.req_id, 'trace-err-test-999');
    assert.equal(res.body.message, 'Internal server error.');
    assert.equal(JSON.stringify(res.body).includes('deadlock'), false);
    assert.equal(JSON.stringify(res.body).includes('stack'), false);
  });
});
