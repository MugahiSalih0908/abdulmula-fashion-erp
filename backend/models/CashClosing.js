// models/CashClosing.js – daily cash closing workflow

const mongoose = require('mongoose');

const cashClosingSchema = new mongoose.Schema({
  date:          { type: String, required: true, unique: true }, // YYYY-MM-DD
  openingCash:   { type: Number, required: true, default: 0 },
  expectedCash:  { type: Number, required: true },   // opening + cash sales - cash expenses
  actualCash:    { type: Number, required: true },   // what cashier counted
  shortage:      { type: Number, default: 0 },       // positive = shortage
  excess:        { type: Number, default: 0 },       // positive = overage
  totalSales:    { type: Number, default: 0 },
  totalExpenses: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'disputed'],
    default: 'pending_approval'
  },
  notes:         { type: String, trim: true, maxlength: 500 },
  closedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  closedByName:  { type: String },
  approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName:{ type: String },
  approvedAt:    { type: Date },
  disputeReason: { type: String, trim: true }
}, { timestamps: true });

cashClosingSchema.index({ date: -1 });
cashClosingSchema.index({ status: 1 });

module.exports = mongoose.model('CashClosing', cashClosingSchema);
