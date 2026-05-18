// models/ExchangeRate.js – tracks USD <-> SSP rates

const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema({
  date:     { type: String, required: true },  // YYYY-MM-DD
  usdToSsp: { type: Number, required: true, min: 0 },  // 1 USD = X SSP
  sspToUsd: { type: Number, required: true, min: 0 },  // 1 SSP = X USD
  setBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

exchangeRateSchema.index({ date: -1 });

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
