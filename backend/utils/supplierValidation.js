const validator = require('validator');

const FIELDS = Object.freeze(['name', 'phone', 'email', 'address', 'company', 'notes']);
const LIMITS = Object.freeze({ name: 100, phone: 40, email: 254, address: 300, company: 100, notes: 1000 });

function validateSupplierPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'A supplier object is required.' };
  const unknown = Object.keys(body).filter(key => !FIELDS.includes(key));
  if (unknown.length) return { error: `Unsupported supplier field(s): ${unknown.join(', ')}.` };

  const value = {};
  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const raw = body[field];
    if (typeof raw !== 'string') return { error: `${field} must be text.`, field };
    const normalized = raw.trim();
    if (normalized.length > LIMITS[field]) return { error: `${field} must be ${LIMITS[field]} characters or fewer.`, field };
    if (field === 'name' && !normalized) return { error: 'Supplier name is required.', field };
    if (field === 'email' && normalized && !validator.isEmail(normalized)) return { error: 'Enter a valid supplier email address.', field };
    value[field] = normalized;
  }
  if (!partial && !value.name) return { error: 'Supplier name is required.', field: 'name' };
  if (partial && Object.keys(value).length === 0) return { error: 'Provide at least one editable supplier field.' };
  return { value };
}

module.exports = { validateSupplierPayload, SUPPLIER_EDITABLE_FIELDS: FIELDS };
