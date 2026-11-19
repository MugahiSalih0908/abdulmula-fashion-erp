const test = require('node:test');
const assert = require('node:assert/strict');
const { validateNewPassword, isValidOpaqueToken } = require('./passwordValidation');

test('accepts bounded strong-length passwords', () => {
  assert.equal(validateNewPassword('CorrectHorse9!'), null);
});

test('rejects non-string, short, oversized and bcrypt-truncated passwords', () => {
  assert.match(validateNewPassword(123456789012), /must be text/);
  assert.match(validateNewPassword('short'), /at least 12/);
  assert.match(validateNewPassword('x'.repeat(129)), /128 characters/);
  assert.match(validateNewPassword('😀'.repeat(19)), /72 UTF-8 bytes/);
});

test('accepts only 64-character hexadecimal one-time tokens', () => {
  assert.equal(isValidOpaqueToken('a'.repeat(64)), true);
  assert.equal(isValidOpaqueToken('z'.repeat(64)), false);
  assert.equal(isValidOpaqueToken('a'.repeat(63)), false);
  assert.equal(isValidOpaqueToken(['a'.repeat(64)]), false);
});
