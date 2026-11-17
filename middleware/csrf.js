const crypto = require('crypto');

module.exports = function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('X-CSRF-Token') || req.body?._csrf || '';
  const expected = req.session.csrfToken;
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'Invalid CSRF token.' });
    return res.status(403).render('error', { message: 'Your form expired. Please go back and try again.' });
  }
  next();
};
