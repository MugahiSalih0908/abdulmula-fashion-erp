// models/Invitation.js – Invitation link authentication system

const mongoose = require('mongoose');
const crypto   = require('crypto');

const invitationSchema = new mongoose.Schema({
  // ── Invitation details ─────────────────────────────────────────
  email:  { type: String, required: true, lowercase: true, trim: true },
  role:   { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },

  // ── Token management ───────────────────────────────────────────
  token:        { type: String, required: true, unique: true, index: true },  // hashed token
  expiresAt:    { type: Date, required: true, index: true },

  // ── Invitation metadata ────────────────────────────────────────
  invitedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:       { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },

  // ── Acceptance tracking ────────────────────────────────────────
  acceptedAt:   { type: Date },
  acceptedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Tracking ───────────────────────────────────────────────────
  sentAt:       { type: Date, default: Date.now },
  lastResentAt: { type: Date },
  resendCount:  { type: Number, default: 0, min: 0 },

}, { timestamps: true });

// ── Index for finding pending invitations ──────────────────────────
invitationSchema.index({ email: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 });
invitationSchema.index({ invitedBy: 1, createdAt: -1 });

// ── Generate secure invitation token ───────────────────────────────
invitationSchema.statics.generateToken = function () {
  const raw   = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed }; // raw goes in email link, hashed stored in DB
};

// ── Virtual: is invitation expired? ────────────────────────────────
invitationSchema.virtual('isExpired').get(function () {
  return this.expiresAt < Date.now();
});

// ── Mark as accepted ──────────────────────────────────────────────
invitationSchema.methods.markAccepted = async function (userId) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  await this.save();
};

// ── Mark as expired ───────────────────────────────────────────────
invitationSchema.methods.markExpired = async function () {
  this.status = 'expired';
  await this.save();
};

// ── Auto-expire old pending invitations ────────────────────────────
invitationSchema.statics.expireOldInvitations = async function () {
  const result = await this.updateMany(
    { status: 'pending', expiresAt: { $lt: Date.now() } },
    { $set: { status: 'expired' } }
  );
  return result;
};

// ── Get invitation statistics for admin ────────────────────────────
invitationSchema.statics.getStats = async function (userId) {
  const pending  = await this.countDocuments({ invitedBy: userId, status: 'pending' });
  const accepted = await this.countDocuments({ invitedBy: userId, status: 'accepted' });
  const expired  = await this.countDocuments({ invitedBy: userId, status: 'expired' });
  return { pending, accepted, expired, total: pending + accepted + expired };
};

// ── Strip sensitive data from JSON ─────────────────────────────────
invitationSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.token; // Never expose hashed token
  return obj;
};

module.exports = mongoose.model('Invitation', invitationSchema);
