const mongoose = require('mongoose');
const Book = require('../models/Book');
const BorrowRecord = require('../models/BorrowRecord');

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function bookInput(input) {
  const totalCopies = Number(input.totalCopies);
  if (input.totalCopies === '' || input.totalCopies == null || !Number.isSafeInteger(totalCopies) || totalCopies < 0) {
    fail('Total copies must be a non-negative whole number.');
  }
  return {
    title: input.title, author: input.author, isbn: input.isbn, category: input.category,
    type: input.type || 'Physical Book', description: input.description || '',
    shelfLocation: input.shelfLocation || '', totalCopies
  };
}

async function transaction(callback) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await callback(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

async function createBook(input) {
  const data = bookInput(input);
  return Book.create({ ...data, availableCopies: data.totalCopies });
}

async function updateBook(id, input) {
  const data = bookInput(input);
  return transaction(async session => {
    const book = await Book.findById(id).session(session);
    if (!book) fail('Book not found.', 404);
    const onLoan = book.totalCopies - book.availableCopies;
    if (data.totalCopies < onLoan) fail(`Total copies cannot be less than the ${onLoan} currently on loan.`);
    Object.assign(book, data, { availableCopies: data.totalCopies - onLoan });
    await book.save({ session });
    return book;
  });
}

async function deleteBook(id) {
  return transaction(async session => {
    const book = await Book.findById(id).session(session);
    if (!book) fail('Book not found.', 404);
    if (await BorrowRecord.exists({ book: id }).session(session)) fail('Books with borrowing history cannot be deleted.');
    await book.deleteOne({ session });
  });
}

async function requestBook(userId, bookId) {
  return transaction(async session => {
    const book = await Book.findOneAndUpdate(
      { _id: bookId, type: 'Physical Book', availableCopies: { $gt: 0 } },
      { $inc: { requestVersion: 1 } }, { session, new: true }
    );
    if (!book) fail('This physical book is unavailable or does not exist.');
    const [record] = await BorrowRecord.create([{ user: userId, book: bookId }], { session });
    return record;
  });
}

async function changeRecord(id, action, actor) {
  return transaction(async session => {
    const record = await BorrowRecord.findById(id).session(session);
    if (!record) fail('Borrowing record not found.', 404);
    if (action === 'cancel') {
      if (actor.role !== 'user' || String(record.user) !== String(actor.id)) fail('Access denied.', 403);
      if (record.status !== 'pending') fail('Only pending requests can be cancelled.');
      record.status = 'cancelled';
    } else {
      if (actor.role !== 'manager') fail('Access denied.', 403);
      if (action === 'approve') {
        if (record.status !== 'pending') fail('Only pending requests can be approved.');
        const book = await Book.findOneAndUpdate(
          { _id: record.book, availableCopies: { $gt: 0 } }, { $inc: { availableCopies: -1 } }, { session, new: true }
        );
        if (!book) fail('No copies are currently available.');
        record.status = 'borrowed';
        record.issueDate = new Date();
        record.dueDate = new Date(record.issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      } else if (action === 'reject') {
        if (record.status !== 'pending') fail('Only pending requests can be rejected.');
        record.status = 'rejected';
      } else if (action === 'return') {
        if (record.status !== 'borrowed') fail('Only borrowed books can be returned.');
        const book = await Book.findOneAndUpdate(
          { _id: record.book, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
          { $inc: { availableCopies: 1 } }, { session, new: true }
        );
        if (!book) fail('Book inventory could not be updated.');
        record.status = 'returned';
        record.returnDate = new Date();
      } else fail('Unknown action.');
    }
    await record.save({ session });
    return record;
  });
}

module.exports = { bookInput, createBook, updateBook, deleteBook, requestBook, changeRecord };
