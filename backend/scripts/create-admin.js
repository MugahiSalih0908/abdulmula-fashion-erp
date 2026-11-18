// scripts/create-admin.js — one-time bootstrap for the first administrator.
// Configure MONGO_URI, ADMIN_EMAIL, and ADMIN_PASSWORD in an untracked .env file.
// The script never supplies or logs a default password.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    throw new Error('ADMIN_EMAIL is required to create or check the bootstrap administrator.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Administrator already exists:', email);
    return;
  }

  const password = String(process.env.ADMIN_PASSWORD || '');
  if (password.length < 12) {
    throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters in the untracked environment file.');
  }

  const name = String(process.env.ADMIN_NAME || 'Abdulmula Fashion Admin').trim();
  const admin = await User.create({
    name,
    email,
    password,
    role: 'admin',
    isVerified: true,
    isActive: true
  });

  console.log('First administrator created:', admin.email);
  console.log('The password was not written to logs. Store it securely and sign in to verify the account.');
}

main()
  .catch(error => {
    console.error('Administrator bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
