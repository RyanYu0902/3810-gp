const mongoose = require('mongoose');

const borrowRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  requestDate: { type: Date, default: Date.now },
  issueDate: Date,
  dueDate: Date,
  returnDate: Date,
  status: { type: String, enum: ['pending', 'borrowed', 'returned', 'rejected', 'cancelled'], default: 'pending' }
}, { timestamps: true });

borrowRecordSchema.index({ user: 1, book: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'borrowed'] } }
});

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);
