const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { hashToken } = require('./tokenUtils');

test('refresh token hashing returns the SHA-256 digest', () => {
  const token = 'header.payload.signature';
  const expected = crypto.createHash('sha256').update(token, 'utf8').digest('hex');

  assert.equal(hashToken(token), expected);
  assert.equal(hashToken(token).length, 64);
  assert.notEqual(hashToken(token), token);
});

test('refresh token hashing rejects empty and non-string values', () => {
  assert.throws(() => hashToken(''), /non-empty token string/);
  assert.throws(() => hashToken(null), /non-empty token string/);
  assert.throws(() => hashToken(undefined), /non-empty token string/);
});
