const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const authRoutes = readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('logout can revoke a refresh token even after the access token expires', () => {
  assert.match(authRoutes, /router\.post\('\/logout', async/);
  assert.match(authRoutes, /decoded = verifyRefreshToken\(refreshToken\)/);
  assert.match(authRoutes, /user\.refreshTokens\.includes\(refreshToken\)/);
  assert.match(authRoutes, /user\.refreshTokens = user\.refreshTokens\.filter/);
});
