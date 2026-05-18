// src/utils/currency.js – multi-currency helpers for SSP / USD

export const CURRENCIES = ['USD', 'SSP'];

/**
 * Format a monetary value
 * @param {number}  amount
 * @param {string}  currency  'USD' | 'SSP'
 * @param {number}  rate      usdToSsp rate (used when displaying SSP equivalent)
 */
export const formatMoney = (amount, currency = 'USD') => {
  if (currency === 'SSP') {
    return `SSP ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `$${Number(amount).toFixed(2)}`;
};

export const usdToSsp = (usd, rate) => usd * rate;
export const sspToUsd = (ssp, rate) => ssp / rate;

export const convertDisplay = (usd, currency, rate) =>
  currency === 'SSP' ? formatMoney(usdToSsp(usd, rate), 'SSP') : formatMoney(usd, 'USD');
