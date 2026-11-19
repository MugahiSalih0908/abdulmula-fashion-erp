const test = require('node:test');
const assert = require('node:assert/strict');
const { hashRefreshToken } = require('./tokenUtils');

test('refresh token storage uses a fixed-length one-way SHA-256 digest', () => {
  const token = 'example.refresh.token.value';
  const digest = hashRefreshToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashRefreshToken(token));
  assert.notEqual(digest, token);
});

test('different refresh tokens produce different stored digests', () => {
  assert.notEqual(hashRefreshToken('refresh-a'), hashRefreshToken('refresh-b'));
});
