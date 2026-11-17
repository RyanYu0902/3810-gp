const express = require('express');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');
const library = require('../services/library');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/csrf', (req, res) => res.json({ csrfToken: res.locals.csrfToken }));
router.use(requireLogin);
router.get('/books', asyncRoute(async (req, res) => res.json(await Book.find().sort({ title: 1 }))));
router.get('/books/:id', asyncRoute(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  res.json(book);
}));
router.post('/books', requireRole('manager'), asyncRoute(async (req, res) => res.status(201).json(await library.createBook(req.body))));
router.put('/books/:id', requireRole('manager'), asyncRoute(async (req, res) => res.json(await library.updateBook(req.params.id, req.body))));
router.delete('/books/:id', requireRole('manager'), asyncRoute(async (req, res) => {
  await library.deleteBook(req.params.id);
  res.status(204).end();
}));
router.get('/borrow-records', asyncRoute(async (req, res) => {
  const filter = req.session.user.role === 'manager' ? {} : { user: req.session.user.id };
  res.json(await BorrowRecord.find(filter).populate('book user', '-password').sort({ requestDate: -1 }));
}));
router.post('/borrow-records', requireRole('user'), asyncRoute(async (req, res) => {
  res.status(201).json(await library.requestBook(req.session.user.id, req.body.bookId));
}));
router.put('/borrow-records/:id', asyncRoute(async (req, res) => {
  res.json(await library.changeRecord(req.params.id, req.body.action, req.session.user));
}));
router.delete('/borrow-records/:id', requireRole('user'), asyncRoute(async (req, res) => {
  res.json(await library.changeRecord(req.params.id, 'cancel', req.session.user));
}));

module.exports = router;
