require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const User = require('../models/User');
const Book = require('../models/Book');

const sampleBooks = [
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', category: 'Fiction', description: 'A story of ambition, love, and illusion in the Jazz Age.', totalCopies: 4, shelfLocation: 'A-01' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', category: 'Science', description: 'An exploration of the universe, from the Big Bang to black holes.', totalCopies: 3, shelfLocation: 'B-04' },
  { title: 'The Design of Everyday Things', author: 'Don Norman', isbn: '9780465050659', category: 'Design', description: 'A guide to making everyday objects more intuitive and human-centred.', totalCopies: 2, shelfLocation: 'C-02' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', isbn: '9780141439518', category: 'Classics', description: 'A witty story of manners, family, and first impressions.', totalCopies: 5, shelfLocation: 'A-03' },
  { title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', category: 'Technology', description: 'A practical guide to writing readable and maintainable software.', totalCopies: 2, shelfLocation: 'D-01' }
];

async function seed() {
  const { MANAGER_NAME, MANAGER_EMAIL, MANAGER_PASSWORD } = process.env;
  const email = String(MANAGER_EMAIL || '').trim().toLowerCase();
  if (!MANAGER_NAME || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !MANAGER_PASSWORD || MANAGER_PASSWORD.length < 8 || Buffer.byteLength(MANAGER_PASSWORD) > 72) {
    throw new Error('Set MANAGER_NAME, a valid MANAGER_EMAIL, and MANAGER_PASSWORD (8 characters minimum, 72 bytes maximum).');
  }
  await connectDatabase();
  const existing = await User.findOne({ email });
  if (existing && existing.role !== 'manager') throw new Error('The manager email belongs to an existing member.');
  if (!existing) {
    await User.create({ name: MANAGER_NAME, email, password: await bcrypt.hash(MANAGER_PASSWORD, 12), role: 'manager' });
    console.log(`Created manager ${email}.`);
  } else console.log(`Manager ${email} already exists; password was not changed.`);
  for (const book of sampleBooks) {
    await Book.updateOne({ isbn: book.isbn }, { $setOnInsert: { ...book, availableCopies: book.totalCopies, type: 'Physical Book' } }, { upsert: true, runValidators: true });
  }
  console.log('Sample catalogue is ready.');
}

seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
