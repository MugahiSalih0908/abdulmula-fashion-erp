const mongoose = require('mongoose');

const CATEGORIES = Object.freeze([
  'Men', 'Women', 'Girls', 'Boys', 'Kids',
  'Sudanese Silk Toub Wraps', 'Accessories', 'Other'
]);
const FIELDS = Object.freeze([
  'name', 'sku', 'barcode', 'price', 'costPrice', 'quantity', 'category',
  'description', 'size', 'color', 'lowStockThreshold', 'supplier', 'imageUrl'
]);
const STRING_LIMITS = Object.freeze({
  name: 120, sku: 80, barcode: 100, description: 500,
  size: 40, color: 50, imageUrl: 2048
});
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function validateNumber(value, field, label, integer = false) {
  if (
    typeof value === 'boolean' ||
    value === '' ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    (integer && !Number.isInteger(Number(value)))
  ) {
    return { field, message: integer
      ? `${label} must be a whole number of zero or more.`
      : `${label} must be a finite number of zero or more.` };
  }
  return null;
}

function validateProductPayload(body, options = {}) {
  const partial = options.partial === true;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { field: 'body', message: 'A product object is required.' };
  }

  const unknown = Object.keys(body).filter(key => !FIELDS.includes(key));
  if (unknown.length) return { field: 'body', message: `Unsupported product field(s): ${unknown.join(', ')}.` };

  if (!partial || has(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) return { field: 'name', message: 'Product name is required.' };
    if (body.name.trim().length > STRING_LIMITS.name) return { field: 'name', message: 'Product name must be 120 characters or fewer.' };
  }
  if (!partial || has(body, 'price')) {
    const error = validateNumber(body.price, 'price', 'Selling price');
    if (error) return error;
  }
  for (const [field, label, integer] of [
    ['costPrice', 'Cost price', false],
    ['quantity', 'Stock quantity', true],
    ['lowStockThreshold', 'Low-stock alert', true]
  ]) {
    if (has(body, field)) {
      const error = validateNumber(body[field], field, label, integer);
      if (error) return error;
    }
  }
  if (!partial || has(body, 'category')) {
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category)) {
      return { field: 'category', message: 'Choose a valid product category.' };
    }
  }

  for (const [field, maxLength] of Object.entries(STRING_LIMITS)) {
    if (!has(body, field) || body[field] === null || body[field] === '') continue;
    if (typeof body[field] !== 'string') return { field, message: `${field} must be text.` };
    if (body[field].trim().length > maxLength) return { field, message: `${field} must be ${maxLength} characters or fewer.` };
  }

  if (has(body, 'supplier') && body.supplier && !mongoose.isValidObjectId(body.supplier)) {
    return { field: 'supplier', message: 'Choose a valid supplier.' };
  }

  if (has(body, 'imageUrl') && body.imageUrl) {
    try {
      const url = new URL(body.imageUrl);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
        return { field: 'imageUrl', message: 'Image URL must be a public HTTPS URL without embedded credentials.' };
      }
    } catch {
      return { field: 'imageUrl', message: 'Enter a valid HTTPS image URL.' };
    }
  }

  if (partial && Object.keys(body).length === 0) return { field: 'body', message: 'Provide at least one product field to update.' };
  return null;
}

module.exports = { validateProductPayload, PRODUCT_CATEGORIES: CATEGORIES };
