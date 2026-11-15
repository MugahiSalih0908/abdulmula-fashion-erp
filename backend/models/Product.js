// models/Product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  sku:         { type: String, trim: true, uppercase: true, sparse: true },
  barcode:     { type: String, trim: true, sparse: true },
  price:       { type: Number, required: true, min: 0 },
  costPrice:   { type: Number, default: 0, min: 0 },
  quantity:    { type: Number, required: true, min: 0, default: 0, validate: { validator: Number.isInteger, message: 'Stock quantity must be a whole number.' } },
  category:    {
    type: String,
    required: true,
    enum: ['Men','Women','Girls','Boys','Kids','Sudanese Silk Toub Wraps','Accessories','Other'],
    default: 'Other'
  },
  description:       { type: String, trim: true, maxlength: 500 },
  size:              { type: String, trim: true },
  color:             { type: String, trim: true },
  imageUrl:          { type: String, trim: true, maxlength: 2048 },
  lowStockThreshold: { type: Number, default: 5, min: 0, validate: { validator: Number.isInteger, message: 'Low-stock threshold must be a whole number.' } },
  supplier:          { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  isDeleted:         { type: Boolean, default: false },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Index for fast POS search
productSchema.index({ name: 'text', sku: 'text', barcode: 'text' });
productSchema.index({ category: 1, isDeleted: 1 });
productSchema.index({ barcode: 1 }, { sparse: true });

module.exports = mongoose.model('Product', productSchema);
