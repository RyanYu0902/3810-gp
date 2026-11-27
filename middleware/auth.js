const User = require('../models/User');

async function requireLogin(req, res, next) {
  if (!req.session.user) {
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please log in.' });
    return res.redirect('/login');
  }
  try {
    const user = await User.findById(req.session.user.id);
    if (!user || (user.sessionVersion || 0) !== (req.session.user.sessionVersion || 0)) {
      return req.session.destroy(error => {
        if (error) return next(error);
        res.clearCookie('library.sid');
        if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please log in.' });
        res.redirect('/login');
      });
    }
    req.session.user.name = user.name;
    req.session.user.role = user.role;
    res.locals.user = req.session.user;
    next();
  } catch (error) {
    next(error);
  }
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
