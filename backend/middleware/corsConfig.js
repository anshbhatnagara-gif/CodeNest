const DEFAULT_PRODUCTION_ORIGIN = 'https://coding-academy-pro-free-course.vercel.app';

export const isAllowedOrigin = (origin) => {
  // Allow requests without an Origin header (e.g. cURL, mobile apps, server-to-server)
  if (!origin) return true;

  const isDev = process.env.NODE_ENV !== 'production';

  // Allow localhost & 127.0.0.1 ONLY in development mode
  if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    DEFAULT_PRODUCTION_ORIGIN
  ].filter(Boolean).map(o => o.toLowerCase().trim());

  return configuredOrigins.includes(origin.toLowerCase().trim());
};

export const corsOptions = {
  origin: function(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
};

export default corsOptions;
