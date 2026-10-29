const ownerMiddleware = (req, res, next) => {
  if (!req.user || typeof req.user !== 'object') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Authentication required.'
    });
  }

  const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();

  if (!configuredOwnerEmail) {
    console.error('Security Warning: OWNER_EMAIL environment variable is not configured.');
    return res.status(500).json({
      success: false,
      message: 'Server security configuration error.'
    });
  }

  const userEmail = typeof req.user.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  const userRole = req.user.role;

  if (userRole !== 'owner' || !userEmail || userEmail !== configuredOwnerEmail) {
    return res.status(403).json({
      success: false,
      message: 'Owner access only.'
    });
  }

  next();
};

export default ownerMiddleware;
