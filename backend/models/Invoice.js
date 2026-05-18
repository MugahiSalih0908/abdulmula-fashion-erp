// models/Invoice.js
// Replaces single-product Sale with a full multi-item invoice

const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },   // snapshot
  sku:         { type: String },
  quantity:    { type: Number, required: true, min: 1 },
  unitPrice:   { type: Number, required: true, min: 0 },
  discount:    { type: Number, default: 0, min: 0 },
  lineTotal:   { type: Number, required: true, min: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },   // auto-generated e.g. INV-20240115-001
  items:         [lineItemSchema],
  subtotal:      { type: Number, required: true, min: 0 },
  discountTotal: { type: Number, default: 0, min: 0 },
  taxAmount:     { type: Number, default: 0, min: 0 },
  taxRate:       { type: Number, default: 0, min: 0 },        // percentage
  grandTotal:    { type: Number, required: true, min: 0 },
  amountPaid:    { type: Number, default: 0, min: 0 },
  balanceDue:    { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['Cash','Credit','Mobile Transfer','Mixed'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid','partial','unpaid'],
    default: 'paid'
  },
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName:  { type: String },
  note:          { type: String, trim: true, maxlength: 300 },
  offlineId:     { type: String, sparse: true },   // client-generated ID for offline dedup
  isSynced:      { type: Boolean, default: true },
  soldBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  soldByName:    { type: String },
  date:          { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-generate invoice number before saving
invoiceSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const d    = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `INV-${date}-${String(count + 1).padStart(4,'0')}`;
  }
  next();
});

invoiceSchema.index({ date: -1 });
invoiceSchema.index({ offlineId: 1 }, { sparse: true });
invoiceSchema.index({ customer: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
