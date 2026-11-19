const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authRoutes = readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('logout can revoke a refresh token even after the access token expires', () => {
  assert.match(authRoutes, /router\\.post\\('\\/logout', async/);
  assert.match(authRoutes, /decoded = verifyRefreshToken\\(refreshToken\\)/);
  assert.match(authRoutes, /hashToken\\(refreshToken\\)/);
  assert.match(authRoutes, /\\$pull: \\{ refreshTokens: storedToken \\}/);
});

test('refresh rotates a stored hash atomically and rejects replay', () => {
  assert.match(authRoutes, /const presentedHash = hashToken\\(refreshToken\\)/);
  assert.match(authRoutes, /refreshTokens: storedToken/);
  assert.match(authRoutes, /'refreshTokens\\.\\$'/);
  assert.match(authRoutes, /rotation\\.modifiedCount !== 1/);
});

test('login migrates legacy plaintext refresh tokens and stores only hashes', () => {
  assert.match(authRoutes, /user\\.refreshTokens = \\(user\\.refreshTokens \\|\\| \\[\\]\\)\\.map/);
  assert.match(authRoutes, /user\\.refreshTokens\\.push\\(hashToken\\(refreshToken\\)\\)/);
});
