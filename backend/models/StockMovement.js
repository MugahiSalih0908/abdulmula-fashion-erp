// models/StockMovement.js
// Tracks every change to product stock quantity

const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type:       {
    type: String,
    enum: ['sale','purchase','adjustment','return','damage','opening'],
    required: true
  },
  quantity:   { type: Number, required: true },   // positive = in, negative = out
  before:     { type: Number, required: true },   // stock before movement
  after:      { type: Number, required: true },   // stock after movement
  reference:  { type: String },                   // invoice number, PO number, etc.
  note:       { type: String, trim: true },
  performedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

stockMovementSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
