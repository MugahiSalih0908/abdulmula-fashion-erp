const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCustomerPayload } = require('./customerValidation');

test('accepts and normalizes customer fields', () => {
  assert.deepEqual(validateCustomerPayload({
    name: '  Amina  ', email: 'AMINA@example.com', phone: ' +211 912 345 678 '
  }), { value: { name: 'Amina', email: 'AMINA@example.com', phone: '+211 912 345 678' } });
});

test('rejects internal fields and mass assignment', () => {
  for (const key of ['creditBalance', 'totalPurchases', 'addedBy', 'isDeleted', 'createdAt']) {
    assert.match(validateCustomerPayload({ [key]: 999 }, { partial: true }).error, /Unsupported customer field/);
  }
});

test('rejects invalid email, oversized fields and missing names', () => {
  assert.match(validateCustomerPayload({ name: 'A', email: 'not-an-email' }).error, /valid customer email/);
  assert.match(validateCustomerPayload({ name: 'x'.repeat(101) }).error, /100 characters/);
  assert.match(validateCustomerPayload({ phone: '123' }).error, /name is required/i);
});

test('partial updates require at least one editable field', () => {
  assert.match(validateCustomerPayload({}, { partial: true }).error, /at least one/);
});
