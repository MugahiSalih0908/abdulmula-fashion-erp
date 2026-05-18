// models/PurchaseOrder.js
// Tracks goods purchased from suppliers — receiving, payment, debt

const mongoose = require('mongoose');

const poLineSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity:    { type: Number, required: true, min: 1 },
  unitCost:    { type: Number, required: true, min: 0 },
  lineTotal:   { type: Number, required: true, min: 0 }
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  poNumber:    { type: String, unique: true },
  supplier:    { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName:{ type: String, required: true },
  items:       [poLineSchema],
  subtotal:    { type: Number, required: true, min: 0 },
  discount:    { type: Number, default: 0, min: 0 },
  grandTotal:  { type: Number, required: true, min: 0 },
  amountPaid:  { type: Number, default: 0, min: 0 },
  balanceDue:  { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['draft','ordered','received','partial','paid'],
    default: 'draft'
  },
  receivedAt:  { type: Date },
  note:        { type: String, trim: true, maxlength: 400 },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

purchaseOrderSchema.pre('save', async function (next) {
  if (!this.poNumber) {
    const d    = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    this.poNumber = `PO-${date}-${String(count + 1).padStart(4,'0')}`;
  }
  next();
});

purchaseOrderSchema.index({ supplier: 1, status: 1 });
purchaseOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
