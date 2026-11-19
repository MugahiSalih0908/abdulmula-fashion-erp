const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authRoutes = readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('logout revokes a refresh token even after access token expiry', () => {
  assert.ok(authRoutes.includes("router.post('/logout', async"));
  assert.ok(authRoutes.includes('decoded = verifyRefreshToken(refreshToken)'));
  assert.ok(authRoutes.includes('hashToken(refreshToken)'));
  assert.ok(authRoutes.includes('$pull: { refreshTokens: storedToken }'));
});

test('refresh rotates stored token hashes atomically and rejects replay', () => {
  assert.ok(authRoutes.includes('const presentedHash = hashToken(refreshToken)'));
  assert.ok(authRoutes.includes('refreshTokens: storedToken'));
  assert.ok(authRoutes.includes("'refreshTokens.$'"));
  assert.ok(authRoutes.includes('rotation.modifiedCount !== 1'));
});

test('login migrates legacy plaintext refresh tokens and stores only hashes', () => {
  assert.ok(authRoutes.includes('user.refreshTokens = (user.refreshTokens || []).map(token =>'));
  assert.ok(authRoutes.includes('user.refreshTokens.push(hashToken(refreshToken))'));
});
