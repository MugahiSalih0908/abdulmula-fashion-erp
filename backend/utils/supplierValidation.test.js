const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSupplierPayload } = require('./supplierValidation');

test('accepts valid supplier details and trims strings', () => {
  assert.deepEqual(validateSupplierPayload({ name: '  Juba Textiles ', company: ' Wholesale ' }), {
    value: { name: 'Juba Textiles', company: 'Wholesale' }
  });
});

test('rejects debt and system fields from API payloads', () => {
  for (const key of ['debtBalance', 'addedBy', 'isDeleted', 'createdAt']) {
    assert.match(validateSupplierPayload({ [key]: 100 }, { partial: true }).error, /Unsupported supplier field/);
  }
});

test('rejects invalid emails and oversized text', () => {
  assert.match(validateSupplierPayload({ name: 'A', email: 'bad' }).error, /valid supplier email/);
  assert.match(validateSupplierPayload({ name: 'x'.repeat(101) }).error, /100 characters/);
});
