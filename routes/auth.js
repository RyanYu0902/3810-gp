const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/login', (req, res) => res.render('auth', { mode: 'login' }));
router.get('/register', (req, res) => res.render('auth', { mode: 'register' }));

router.post('/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      password.length < 8 || Buffer.byteLength(password) > 72) {
    const error = new Error('Enter a name, valid email, and a password of at least 8 characters (at most 72 bytes).');
    error.status = 400;
    throw error;
  }
  await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'user' });
  req.session.notice = 'Account created. Please sign in.';
  res.redirect('/login');
}));

router.post('/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+password');
  if (!user || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, user.password))) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }
  req.session.regenerate(error => {
    if (error) return nextSessionError(error, res);
    req.session.user = { id: String(user._id), name: user.name, role: user.role };
    req.session.save(saveError => {
      if (saveError) return nextSessionError(saveError, res);
      res.redirect(user.role === 'manager' ? '/manager/dashboard' : '/user/dashboard');
    });
  });
}));

function nextSessionError(error, res) {
  console.error(error);
  res.status(500).send('Could not start a session.');
}

router.post('/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('library.sid');
    res.redirect('/login');
  });
});

module.exports = router;
