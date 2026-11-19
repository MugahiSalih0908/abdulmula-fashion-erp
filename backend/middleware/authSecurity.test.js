const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authMiddleware = readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('access JWTs issued before a password change are rejected', () => {
  assert.match(authMiddleware, /user\.passwordChangedAt/);
  assert.match(authMiddleware, /decoded\.iat < Math\.floor\(user\.passwordChangedAt\.getTime\(\) \/ 1000\)/);
  assert.match(authMiddleware, /code: 'SESSION_INVALIDATED'/);
});

test('new access JWTs must belong to an active device session', () => {
  assert.ok(authMiddleware.includes("select('-password -refreshTokens +activeSessions')"));
  assert.ok(authMiddleware.includes('decoded.sid && !user.activeSessions?.includes(decoded.sid)'));
  assert.match(authMiddleware, /code: 'SESSION_REVOKED'/);
});
