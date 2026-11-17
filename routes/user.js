const express = require('express');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const library = require('../services/library');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(requireLogin, requireRole('user'));

router.get('/dashboard', asyncRoute(async (req, res) => {
  const records = await BorrowRecord.find({ user: req.session.user.id }).populate('book').sort({ requestDate: -1 }).limit(5);
  const [bookCount, borrowedCount, pendingCount] = await Promise.all([
    Book.countDocuments(),
    BorrowRecord.countDocuments({ user: req.session.user.id, status: 'borrowed' }),
    BorrowRecord.countDocuments({ user: req.session.user.id, status: 'pending' })
  ]);
  res.render('dashboard', { records, stats: [['Titles in catalogue', bookCount], ['Your loans', borrowedCount], ['Pending requests', pendingCount]] });
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
  res.render('records', { records, manager: false, heading: 'My borrowing' });
}));

router.post('/borrow-records/:id/cancel', asyncRoute(async (req, res) => {
  await library.changeRecord(req.params.id, 'cancel', req.session.user);
  req.session.notice = 'Request cancelled.';
  res.redirect('/user/my-borrowings');
}));

module.exports = router;
