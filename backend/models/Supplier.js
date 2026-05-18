// models/Supplier.js

const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  phone:       { type: String, trim: true },
  email:       { type: String, trim: true, lowercase: true },
  address:     { type: String, trim: true },
  company:     { type: String, trim: true },
  debtBalance: { type: Number, default: 0, min: 0 },   // we owe them
  notes:       { type: String, trim: true },
  isDeleted:   { type: Boolean, default: false },
  addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
