require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/database');
const User = require('../models/User');

async function setupManager() {
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
}

setupManager().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
