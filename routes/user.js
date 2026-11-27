const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const User = require('../models/User');
const library = require('../services/library');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const versionMatch = version => version ? version : { $in: [0, null] };
router.use(requireLogin, requireRole('user'));

router.get('/dashboard', (req, res) => res.redirect('/user/my-borrowings'));

router.get('/account', asyncRoute(async (req, res) => {
  const account = await User.findById(req.session.user.id).select('+password');
  if (!account) return res.redirect('/login');
  res.render('account', { account, hasPassword: !!account.password });
}));

router.post('/account/name', asyncRoute(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 100) {
    const error = new Error('Enter a name of up to 100 characters.');
    error.status = 400;
    throw error;
  }
  const account = await User.findByIdAndUpdate(req.session.user.id, { name }, { new: true, runValidators: true });
  if (!account) return res.redirect('/login');
  req.session.user.name = account.name;
  req.session.notice = 'Your name has been updated.';
  res.redirect('/user/account');
}));

router.post('/account/password', asyncRoute(async (req, res) => {
  const account = await User.findById(req.session.user.id).select('+password');
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';
  if (!account || !account.password || Buffer.byteLength(currentPassword) > 72 || !(await bcrypt.compare(currentPassword, account.password))) {
    const error = new Error('Current password is incorrect or this account uses Google sign-in.');
    error.status = 400;
    throw error;
  }
  if (newPassword.length < 8 || Buffer.byteLength(newPassword) > 72 || newPassword !== confirmPassword) {
    const error = new Error('New passwords must match and contain at least 8 characters and at most 72 bytes.');
    error.status = 400;
    throw error;
  }
  const password = await bcrypt.hash(newPassword, 12);
  const updated = await User.findOneAndUpdate(
    { _id: account._id, password: account.password, sessionVersion: versionMatch(account.sessionVersion) },
    { $set: { password }, $inc: { sessionVersion: 1 } }, { new: true }
  );
  if (!updated) {
    const error = new Error('Your account has changed. Please sign in and try again.');
    error.status = 409;
    throw error;
  }
  req.session.user.sessionVersion = updated.sessionVersion;
  req.session.notice = 'Your password has been updated. Other sessions must sign in again.';
  res.redirect('/user/account');
}));

router.post('/account/delete', asyncRoute(async (req, res, next) => {
  const account = await User.findById(req.session.user.id).select('+password');
  if (account && account.googleId) {
    const error = new Error('Accounts using Google sign-in cannot be deleted here.');
    error.status = 403;
    throw error;
  }
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!account || req.body.confirmation !== 'DELETE' || (account.password &&
      (Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, account.password))))) {
    const error = new Error('Enter DELETE and your current password, if applicable.');
    error.status = 400;
    throw error;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await User.findOne({ _id: account._id, googleId: { $in: [null, ''] }, sessionVersion: versionMatch(account.sessionVersion) }).session(session);
      if (!current) {
        const error = new Error('Your account has changed. Please sign in and try again.');
        error.status = 409;
        throw error;
      }
      if (await BorrowRecord.exists({ user: account._id, status: { $in: ['pending', 'borrowed'] } }).session(session)) {
        const error = new Error('Cancel pending requests and return all borrowed books before deleting your account.');
        error.status = 400;
        throw error;
      }
      await current.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('library.sid');
    res.redirect('/login');
  });
}));

router.get('/books', asyncRoute(async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 100);
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = search ? { $or: ['title', 'author', 'category', 'isbn'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } })) } : {};
  const books = await Book.find(query).sort({ title: 1 });
  res.render('books', { books, search, manager: false });
}));

router.get('/books/:id', asyncRoute(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).render('error', { message: 'Book not found.' });
  res.render('book-detail', { book });
}));

router.post('/books/:id/request', asyncRoute(async (req, res) => {
  await library.requestBook(req.session.user.id, req.params.id);
  req.session.notice = 'Your request has been submitted.';
  res.redirect('/user/my-borrowings');
}));

router.get(['/my-borrowings', '/history'], asyncRoute(async (req, res) => {
  const records = await BorrowRecord.find({ user: req.session.user.id }).populate('book').sort({ requestDate: -1 });
  res.render('records', { records, manager: false, heading: 'My loans' });
}));

router.post('/borrow-records/:id/cancel', asyncRoute(async (req, res) => {
  await library.changeRecord(req.params.id, 'cancel', req.session.user);
  req.session.notice = 'Request cancelled.';
  res.redirect('/user/my-borrowings');
}));

module.exports = router;
