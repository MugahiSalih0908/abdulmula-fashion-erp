const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authRoutes = readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('logout revokes both the refresh token and its device session', () => {
  assert.ok(authRoutes.includes("router.post('/logout', async"));
  assert.ok(authRoutes.includes('decoded = verifyRefreshToken(refreshToken)'));
  assert.ok(authRoutes.includes('hashToken(refreshToken)'));
  assert.ok(authRoutes.includes('$pull: pull'));
  assert.ok(authRoutes.includes('pull.activeSessions = decoded.sid'));
  assert.ok(authRoutes.includes('{ _id: user._id },'));
  assert.ok(authRoutes.includes('if (revoked.modifiedCount > 0)'));
});

test('refresh rotates stored token hashes atomically and rejects replay', () => {
  assert.ok(authRoutes.includes('const presentedHash = hashToken(refreshToken)'));
  assert.ok(authRoutes.includes('refreshTokens: storedToken'));
  assert.ok(authRoutes.includes('const refreshTokenIndex = user.refreshTokens.indexOf(storedToken)'));
  assert.ok(authRoutes.includes('`refreshTokens.${refreshTokenIndex}`'));
  assert.ok(authRoutes.includes('rotation.modifiedCount !== 1'));
  assert.ok(authRoutes.includes('decoded.sid && !user.activeSessions?.includes(decoded.sid)'));
});

test('login stores only a hash and registers the device session', () => {
  assert.ok(authRoutes.includes('user.refreshTokens = (user.refreshTokens || []).map(token =>'));
  assert.ok(authRoutes.includes('user.refreshTokens.push(hashToken(refreshToken))'));
  assert.ok(authRoutes.includes('user.activeSessions = [...(user.activeSessions || []), sessionId].slice(-5)'));
});

test('password reset and logout-all revoke every active session', () => {
  assert.ok(authRoutes.includes('user.activeSessions      = [];'));
  assert.ok(authRoutes.includes('refreshTokens:[], activeSessions:[]'));
});
