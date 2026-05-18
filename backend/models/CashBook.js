// models/CashBook.js
// Daily cashbook: opening balance, closing balance, cash movements

const mongoose = require('mongoose');

const cashBookSchema = new mongoose.Schema({
  date:           { type: String, required: true, unique: true }, // YYYY-MM-DD
  openingCash:    { type: Number, default: 0, min: 0 },
  closingCash:    { type: Number, default: 0, min: 0 },
  totalSalesCash: { type: Number, default: 0 },
  totalExpenses:  { type: Number, default: 0 },
  totalReceived:  { type: Number, default: 0 },  // supplier payments received
  note:           { type: String, trim: true },
  openedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt:       { type: Date },
  isClosed:       { type: Boolean, default: false },
  currency:       { type: String, enum: ['USD','SSP'], default: 'USD' }
}, { timestamps: true });

cashBookSchema.index({ date: -1 });

module.exports = mongoose.model('CashBook', cashBookSchema);
