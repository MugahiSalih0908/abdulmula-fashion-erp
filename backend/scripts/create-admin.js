// scripts/create-admin.js – run once to seed the first admin account
// Usage: node scripts/create-admin.js

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/User');

const ADMIN = {
  name:     process.env.ADMIN_NAME     || 'mugahid salih adam',
  email:    process.env.ADMIN_EMAIL    || 'wadsalih2003@gmail.com',
  password: process.env.ADMIN_PASSWORD || 'Mugahid@2026',
  role:     'admin',
  isVerified: true,          // admin is pre-verified
  isActive:   true,
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  Connected to MongoDB');

    const exists = await User.findOne({ email: ADMIN.email });
    if (exists) {
      console.log(`⚠️   Admin already exists: ${ADMIN.email}`);
      process.exit(0);
    }

    const admin = await User.create(ADMIN);
    console.log('\n✅  First admin created!');
    console.log(`   Name:     ${admin.name}`);
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${ADMIN.password}`);
    console.log('\n⚠️   CHANGE THIS PASSWORD immediately after first login!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  }
})();
