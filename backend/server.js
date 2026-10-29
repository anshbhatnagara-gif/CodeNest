import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import corsOptions from './middleware/corsConfig.js';

import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';
import notesRoutes from './routes/notesRoutes.js';
import ownerNotesRoutes from './routes/ownerNotesRoutes.js';

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

// Static Uploads Directory removed for security. All attachment downloads are handled via authenticated /api/notes/:id/download.

// CORS Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'CodeNest Backend is running ✅', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/owner/notes', ownerNotesRoutes);

// 404 Handler
app.use((req, res) => {

  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    message: isDev ? `Server error: ${err.message}` : 'Internal server error.'
  });
});

// Start Server
const start = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CodeNest Backend running on port ${PORT}`);
  });
};

start();
