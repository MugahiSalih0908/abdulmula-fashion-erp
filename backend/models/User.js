// models/User.js – v6 full enterprise auth model

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 60 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['admin','manager','staff'], default: 'staff' },

  // ── Account status ─────────────────────────────────────────
  isActive:   { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },  // must activate email before login
  salary:     { type: Number,  default: 0, min: 0 },

  // ── Email verification / activation ────────────────────────
  verificationToken:       { type: String, select: false },
  verificationTokenExpire: { type: Date,   select: false },

  // ── Password reset ─────────────────────────────────────────
  resetPasswordToken:  { type: String, select: false },
  resetPasswordExpire: { type: Date,   select: false },

  // ── Login security ─────────────────────────────────────────
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     { type: Date },
  lastLogin:     { type: Date },
  lastLoginIP:   { type: String },

  // ── Refresh tokens (multi-device) ──────────────────────────
  refreshTokens: [{ type: String, select: false }],

  passwordChangedAt: { type: Date },
}, { timestamps: true });

// ── Virtual: is account currently locked? ─────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Hash password before save ─────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password          = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

// ── Compare passwords ─────────────────────────────────────────
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Generate verification token ───────────────────────────────
userSchema.methods.generateVerificationToken = function () {
  const raw   = crypto.randomBytes(32).toString('hex');
  this.verificationToken       = crypto.createHash('sha256').update(raw).digest('hex');
  this.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return raw; // return unhashed – goes in the email link
};

// ── Generate password reset token ─────────────────────────────
userSchema.methods.generateResetToken = function () {
  const raw   = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken  = crypto.createHash('sha256').update(raw).digest('hex');
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  return raw;
};

// ── Increment failed login attempts + lock after 5 ───────────
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    // Lock expired – reset
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30-min lock
  }
  return this.updateOne(updates);
};

// ── Strip sensitive fields from JSON ─────────────────────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.verificationToken;
  delete obj.verificationTokenExpire;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
