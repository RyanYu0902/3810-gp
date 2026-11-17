const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'manager'], default: 'user', required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
