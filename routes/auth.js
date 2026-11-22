const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function googleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return null;
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI };
}

router.get('/login', (req, res) => res.render('auth', { mode: 'login', googleAuthEnabled: !!googleConfig() }));
router.get('/register', (req, res) => res.render('auth', { mode: 'register', googleAuthEnabled: !!googleConfig() }));

router.get('/auth/google', (req, res, next) => {
  const config = googleConfig();
  if (!config) return res.status(503).render('error', { message: 'Google sign-in is not configured.' });
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  req.session.googleOAuth = { state, nonce, codeVerifier, createdAt: Date.now() };
  const url = client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'], state, nonce,
    code_challenge: codeChallenge, code_challenge_method: 'S256'
  });
  req.session.save(error => error ? next(error) : res.redirect(url));
});

router.get('/auth/google/callback', asyncRoute(async (req, res) => {
  const config = googleConfig();
  const oauth = req.session.googleOAuth;
  delete req.session.googleOAuth;
  if (!config || !oauth || typeof req.query.state !== 'string' ||
      req.query.state !== oauth.state || Date.now() - oauth.createdAt > 10 * 60 * 1000) {
    return res.status(400).render('error', { message: 'Google sign-in has expired or is invalid. Please try again.' });
  }
  if (typeof req.query.code !== 'string' || !req.query.code) {
    return res.status(400).render('error', { message: 'Google sign-in was cancelled or failed. Please try again.' });
  }
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  let profile;
  try {
    const { tokens } = await client.getToken({ code: req.query.code, codeVerifier: oauth.codeVerifier });
    if (!tokens.id_token) throw new Error('Missing ID token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    profile = ticket.getPayload();
  } catch (error) {
    return res.status(401).render('error', { message: 'Google sign-in could not be verified. Please try again.' });
  }
  if (!profile || profile.nonce !== oauth.nonce || !profile.sub || profile.email_verified !== true ||
      typeof profile.email !== 'string' || profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    return res.status(401).render('error', { message: 'Google did not provide a verified email address. Please try again.' });
  }
  const email = profile.email.trim().toLowerCase();
  let user = await User.findOne({ googleId: profile.sub });
  if (!user) {
    if (await User.findOne({ email })) {
      return res.status(409).render('error', { message: 'An account with this email already exists. Please sign in with your existing method.' });
    }
    const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, 100) : '';
    user = await User.create({ name: name || email.slice(0, 100), email, googleId: profile.sub, role: 'user' });
  }
  signIn(req, res, user);
}));

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
  if (!user || !user.password || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, user.password))) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }
  signIn(req, res, user);
}));

function signIn(req, res, user) {
  req.session.regenerate(error => {
    if (error) return nextSessionError(error, res);
    req.session.user = { id: String(user._id), name: user.name, role: user.role };
    req.session.save(saveError => {
      if (saveError) return nextSessionError(saveError, res);
      res.redirect(user.role === 'manager' ? '/manager/dashboard' : '/user/dashboard');
    });
  });
}

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
