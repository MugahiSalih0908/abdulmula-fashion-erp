const mongoose = require('mongoose');

const emailWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true, index: true },
  providerEmailId: { type: String, index: true },
  recipient: { type: String, lowercase: true, trim: true },
  occurredAt: { type: Date, required: true },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

emailWebhookEventSchema.index({ providerEmailId: 1, occurredAt: -1 });

module.exports = mongoose.model('EmailWebhookEvent', emailWebhookEventSchema);
