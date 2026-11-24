// models/AuditLog.js
// Immutable record of all significant user actions

const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../utils/auditActions');

const auditLogSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:   { type: String },
  action:     { type: String, enum: [...AUDIT_ACTIONS], required: true }, // values: utils/auditActions.js
  entity:     { type: String },    // e.g. 'Product', 'Invoice'
  entityId:   { type: String },    // MongoDB _id as string
  details:    { type: mongoose.Schema.Types.Mixed },  // before/after snapshot
  ip:         { type: String },
  userAgent:  { type: String }
}, {
  timestamps: true,
  // Audit logs are never updated – only inserted
});

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
