// models/Customer.js

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true, maxlength: 100 },
  phone:         { type: String, trim: true },
  email:         { type: String, trim: true, lowercase: true },
  address:       { type: String, trim: true },
  creditBalance: { type: Number, default: 0, min: 0 },
  totalPurchases:{ type: Number, default: 0 },
  notes:         { type: String, trim: true },
  isDeleted:     { type: Boolean, default: false },
  addedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

customerSchema.index({ name: 'text', phone: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
