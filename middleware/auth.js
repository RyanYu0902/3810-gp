function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please log in.' });
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.user?.role !== role) {
      if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Access denied.' });
      return res.status(403).render('error', { message: 'You do not have permission to access this page.' });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
