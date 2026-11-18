const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  recipient: { type: String, required: true, lowercase: true, trim: true },
  sender: { type: String, trim: true },
  subject: { type: String, required: true, maxlength: 240 },
  category: {
    type: String,
    enum: ['staff_activation', 'staff_invitation', 'password_reset', 'password_changed', 'security_alert', 'business_notification', 'system'],
    default: 'system',
    index: true
  },
  provider: { type: String, enum: ['resend'], default: 'resend' },
  providerEmailId: { type: String, index: true, sparse: true },
  idempotencyKey: { type: String, required: true, unique: true, select: false },
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'blocked', 'failed', 'unknown'],
    default: 'queued',
    index: true
  },
  attempts: { type: Number, default: 0, min: 0 },
  lastAttemptAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  lastEventAt: { type: Date },
  lastEventType: { type: String },
  lastErrorCode: { type: String, maxlength: 80 },
  lastErrorMessage: { type: String, maxlength: 240 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedEntity: { type: String, maxlength: 40 },
  relatedEntityId: { type: String }
}, { timestamps: true });

emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ category: 1, createdAt: -1 });
emailLogSchema.index({ recipient: 1, createdAt: -1 });

emailLogSchema.methods.toJSON = function () {
  const value = this.toObject();
  delete value.idempotencyKey;
  return value;
};

module.exports = mongoose.model('EmailLog', emailLogSchema);
