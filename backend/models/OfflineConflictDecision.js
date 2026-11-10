const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  offlineQuotedUnitPrice: { type: Number, required: true, min: 0 },
  reviewedUnitPrice: { type: Number, min: 0 },
  clientReportedConflictPrice: { type: Number, min: 0 },
  clientReportedConflictPriceSource: { type: String }
}, { _id: false });

const decisionSchema = new mongoose.Schema({
  offlineId: {
    type: String,
    required: true,
    validate: {
      validator: value =>
        typeof value === 'string' &&
        value.length > 0 &&
        value === value.trim()
    }
  },
  state: { type: String, enum: ['pending', 'approved', 'rejected', 'consumed'], required: true },
  decisionType: { type: String, enum: ['accepted', 'approved', 'rejected'] },
  payloadFingerprint: { type: String, match: /^[a-f0-9]{64}$/ },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedByName: { type: String },
  approvedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedByName: { type: String },
  rejectedAt: { type: Date },
  consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  consumedByName: { type: String },
  consumedAt: { type: Date },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  items: { type: [itemSchema], default: [] },
  rejectionItems: { type: [itemSchema], default: [] },
  clientReportedOfflineAt: { type: String },
  clientReportedOfflineAtSource: { type: String }
}, { timestamps: true });

decisionSchema.index(
  { offlineId: 1 },
  {
    name: 'offlineId_unique_nonempty',
    unique: true,
    partialFilterExpression: { offlineId: { $type: 'string', $gt: '' } }
  }
);

module.exports = mongoose.model('OfflineConflictDecision', decisionSchema);
