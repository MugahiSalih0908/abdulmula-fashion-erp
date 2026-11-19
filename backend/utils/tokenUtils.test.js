const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const {
  hashToken,
  generateAccessToken,
  generateRefreshToken
} = require('./tokenUtils');

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

test('access and refresh JWTs carry the same device session identifier', () => {
  process.env.JWT_SECRET = 'test-access-secret-with-at-least-32-bytes';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-32-bytes';

  const userId = 'user-123';
  const sessionId = 'session-abc';
  const access = jwt.verify(generateAccessToken(userId, sessionId), process.env.JWT_SECRET);
  const refresh = jwt.verify(generateRefreshToken(userId, sessionId), process.env.JWT_REFRESH_SECRET);

  assert.equal(access.id, userId);
  assert.equal(refresh.id, userId);
  assert.equal(access.sid, sessionId);
  assert.equal(refresh.sid, sessionId);
});
