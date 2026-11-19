const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = file => readFileSync(path.join(__dirname, file), 'utf8');

test('refresh rotation is an atomic conditional database update', () => {
  const auth = read('./auth.js');
  assert.match(auth, /User\.findOneAndUpdate\([\s\S]*?refreshTokens: \{ \$in: consumedTokens \}[\s\S]*?buildRefreshTokenRotationPipeline/);
  assert.doesNotMatch(auth, /const user = await User\.findById\(decoded\.id\)\.select\('\+refreshTokens'\)/);
});

test('login adds refresh tokens atomically without replacing other devices sessions', () => {
  const auth = read('./auth.js');
  assert.match(auth, /\$push: \{ refreshTokens: \{ \$each: \[hashRefreshToken\(refreshToken\)\], \$slice: -5 \} \}/);
});

test('single-device logout removes only the supplied raw or digested token atomically', () => {
  const auth = read('./auth.js');
  assert.match(auth, /\$pull: \{ refreshTokens: \{ \$in: \[refreshToken, digest\] \} \}/);
});

test('invitation auto-login stores only a refresh-token digest', () => {
  const invitations = read('./invitations.js');
  assert.match(invitations, /refreshTokens: hashRefreshToken\(refreshToken\)/);
  assert.doesNotMatch(invitations, /refreshTokens\s*=\s*\[refreshToken\]/);
});
