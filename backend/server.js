import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pool, { connectDB } from './config/db.js';
import corsOptions from './middleware/corsConfig.js';

import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import notesRoutes from './routes/notesRoutes.js';
import ownerNotesRoutes from './routes/ownerNotesRoutes.js';
import ownerCourseRoutes from './routes/ownerCourseRoutes.js';
import ownerModuleRoutes from './routes/ownerModuleRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Proxy Configuration for cloud hosting (Render / Vercel proxies)
const trustProxySetting = process.env.TRUST_PROXY;

if (trustProxySetting === 'true' || trustProxySetting === '1') {
  app.set('trust proxy', 1);
} else if (trustProxySetting && !isNaN(parseInt(trustProxySetting, 10))) {
  app.set('trust proxy', parseInt(trustProxySetting, 10));
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Helmet Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'https:', 'http:']
      }
    }
  })
);

// Request ID & Structured HTTP Access Logging Middleware
export const requestIdMiddleware = (req, res, next) => {
  const incomingReqId = req.headers['x-request-id'];
  const reqId = typeof incomingReqId === 'string' && incomingReqId.trim()
    ? incomingReqId.trim().substring(0, 100)
    : crypto.randomUUID();

  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);

  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'HTTP_REQUEST',
      reqId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: durationMs
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
};

app.use(requestIdMiddleware);

// HTTP Response Compression Middleware (Threshold: 1KB; respects x-no-compression)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  })
);

// Static Uploads Directory removed for security. All attachment downloads are handled via authenticated /api/notes/:id/download.

// CORS Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check with Database Connectivity Probe
export const healthCheckHandler = async (req, res) => {
  const start = Date.now();
  const probeTimeoutMs = parseInt(process.env.DB_HEALTH_TIMEOUT_MS || '3000', 10);

  try {
    const probePromise = pool.query('SELECT 1 AS health_check');
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error('Database health check timeout'));
      }, probeTimeoutMs);
    });

    try {
      await Promise.race([probePromise, timeoutPromise]);
    } finally {
      clearTimeout(timerId);
    }

    const latencyMs = Date.now() - start;

    return res.status(200).json({
      success: true,
      status: 'CodeNest Backend is running ✅',
      database: 'connected',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    console.error('Database Health Check Failed:', error.message);

    return res.status(503).json({
      success: false,
      status: 'Service Degraded',
      database: 'disconnected',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/api/health', healthCheckHandler);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/owner/notes', ownerNotesRoutes);
app.use('/api/owner/courses', ownerCourseRoutes);
app.use('/api/owner/modules', ownerModuleRoutes);

// 404 Handler
app.use((req, res) => {

  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global Error Handler with Request Context
app.use((err, req, res, next) => {
  const reqId = req.id || req.headers['x-request-id'] || 'unknown';
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      type: 'UNHANDLED_ROUTE_ERROR',
      reqId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  );

  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || err.statusCode || 500).json({
    success: false,
    req_id: reqId,
    message: isDev ? `Server error: ${err.message}` : 'Internal server error.'
  });
});

// Start Server only when executed directly as entrypoint
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

// Process-Level Exception & Rejection Handlers (guarded against duplicate test registration)
if (isMain && process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (reason) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'FATAL',
        type: 'UNHANDLED_REJECTION',
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
      })
    );
  });

  process.on('uncaughtException', (err) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'FATAL',
        type: 'UNCAUGHT_EXCEPTION',
        message: err.message,
        stack: err.stack
      })
    );
    // Graceful exit so container orchestrator / Render cleanly restarts the process
    process.exit(1);
  });
}

const start = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CodeNest Backend running on port ${PORT}`);
  });
};

if (isMain && process.env.NODE_ENV !== 'test') {
  start();
}

export { app };
export default app;
