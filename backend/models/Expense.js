// models/Expense.js

const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  amount:      { type: Number, required: true, min: 0.01 },
  category:    {
    type: String,
    enum: ['Rent','Transport','Salaries','Electricity','Stock Purchase','Marketing','Maintenance','Other'],
    default: 'Other'
  },
  description: { type: String, trim: true, maxlength: 300 },
  addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date:        { type: Date, default: Date.now }
}, { timestamps: true });

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
