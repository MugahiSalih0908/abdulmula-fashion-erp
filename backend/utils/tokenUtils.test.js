const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { hashRefreshToken } = require('./tokenUtils');

test('refresh tokens are stored as deterministic SHA-256 hex digests', () => {
  const token = 'header.payload.signature';
  const digest = hashRefreshToken(token);

  assert.equal(digest, crypto.createHash('sha256').update(token, 'utf8').digest('hex'));
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
});

test('refresh token hashing rejects missing and non-string inputs', () => {
  for (const invalid of ['', null, undefined, 123, {}]) {
    assert.throws(() => hashRefreshToken(invalid), TypeError);
  }
});

test('different refresh tokens produce different stored digests', () => {
  assert.notEqual(hashRefreshToken('token-a'), hashRefreshToken('token-b'));
});
