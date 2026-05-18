// models/AuditLog.js
// Immutable record of all significant user actions

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:   { type: String },
  action:     {
    type: String,
    enum: [
      'LOGIN','LOGOUT','LOGIN_FAILED',
      'PRODUCT_CREATE','PRODUCT_UPDATE','PRODUCT_DELETE',
      'INVOICE_CREATE','INVOICE_DELETE',
      'EXPENSE_CREATE','EXPENSE_DELETE',
      'CUSTOMER_CREATE','CUSTOMER_UPDATE','CUSTOMER_DELETE',
      'SUPPLIER_CREATE','SUPPLIER_UPDATE','SUPPLIER_DELETE',
      'STOCK_ADJUST','USER_CREATE','USER_UPDATE'
    ],
    required: true
  },
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
