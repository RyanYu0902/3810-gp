const express = require('express');
const Book = require('../models/Book');
const User = require('../models/User');
const BorrowRecord = require('../models/BorrowRecord');
const library = require('../services/library');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.use(requireLogin, requireRole('manager'));

router.get('/dashboard', asyncRoute(async (req, res) => {
  const [titles, members, pending, overdue, records] = await Promise.all([
    Book.countDocuments(), User.countDocuments({ role: 'user' }),
    BorrowRecord.countDocuments({ status: 'pending' }),
    BorrowRecord.countDocuments({ status: 'borrowed', dueDate: { $lt: new Date() } }),
    BorrowRecord.find().populate('book user').sort({ requestDate: -1 }).limit(5)
  ]);
  res.render('dashboard', { records, stats: [['Titles', titles], ['Members', members], ['Pending requests', pending], ['Overdue loans', overdue]] });
}));

router.get('/books', asyncRoute(async (req, res) => {
  const books = await Book.find().sort({ title: 1 });
  res.render('books', { books, search: '', manager: true });
}));
router.get('/books/add', (req, res) => res.render('book-form', { book: null }));
router.post('/books', asyncRoute(async (req, res) => {
  await library.createBook(req.body);
  req.session.notice = 'Book added to the catalogue.';
  res.redirect('/manager/books');
}));
router.get('/books/:id/edit', asyncRoute(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).render('error', { message: 'Book not found.' });
  res.render('book-form', { book });
}));
router.post('/books/:id/edit', asyncRoute(async (req, res) => {
  await library.updateBook(req.params.id, req.body);
  req.session.notice = 'Book updated.';
  res.redirect('/manager/books');
}));
router.post('/books/:id/delete', asyncRoute(async (req, res) => {
  await library.deleteBook(req.params.id);
  req.session.notice = 'Book deleted.';
  res.redirect('/manager/books');
}));
router.get(['/borrow-requests', '/borrow-records'], asyncRoute(async (req, res) => {
  const pendingOnly = req.path === '/borrow-requests';
  const records = await BorrowRecord.find(pendingOnly ? { status: 'pending' } : {}).populate('book user').sort({ requestDate: -1 });
  res.render('records', { records, manager: true, heading: pendingOnly ? 'Borrow requests' : 'All borrowing records' });
}));
router.post('/borrow-records/:id/:action', asyncRoute(async (req, res) => {
  await library.changeRecord(req.params.id, req.params.action, req.session.user);
  req.session.notice = 'Borrowing record updated.';
  res.redirect('/manager/borrow-records');
}));
router.get('/users', asyncRoute(async (req, res) => {
  const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
  res.render('users', { users });
}));

module.exports = router;
