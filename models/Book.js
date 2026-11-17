const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  author: { type: String, required: true, trim: true, maxlength: 150 },
  isbn: { type: String, required: true, trim: true, unique: true, maxlength: 30 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['Physical Book', 'E-book'], default: 'Physical Book' },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  totalCopies: { type: Number, required: true, min: 0, validate: Number.isInteger },
  availableCopies: { type: Number, required: true, min: 0, validate: Number.isInteger },
  requestVersion: { type: Number, default: 0, select: false },
  shelfLocation: { type: String, trim: true, maxlength: 100, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
