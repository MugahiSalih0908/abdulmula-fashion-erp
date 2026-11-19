const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionSecurity } = require('./securityConfig');

const validProductionEnv = () => ({
  NODE_ENV: 'production',
  CLIENT_URL: 'https://abdulmulafashion.com',
  CLIENT_PREVIEW_URL: 'https://abdulmula-fashion-preview-mugahid-s-projects.vercel.app',
  FRONTEND_URL: 'https://abdulmulafashion.com',
  JWT_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64)
});

test('development does not require production URLs or secrets', () => {
  assert.equal(validateProductionSecurity({ NODE_ENV: 'development' }), true);
});

test('production accepts exact HTTPS origins and independent strong JWT secrets', () => {
  assert.equal(validateProductionSecurity(validProductionEnv()), true);
});

test('production requires the frontend origin and canonical frontend URL', () => {
  const env = validProductionEnv();
  delete env.CLIENT_URL;
  assert.throws(() => validateProductionSecurity(env), /CLIENT_URL/);

  const envWithoutFrontendUrl = validProductionEnv();
  delete envWithoutFrontendUrl.FRONTEND_URL;
  assert.throws(() => validateProductionSecurity(envWithoutFrontendUrl), /FRONTEND_URL/);
});

test('production rejects HTTP origins and URL paths', () => {
  const httpEnv = validProductionEnv();
  httpEnv.CLIENT_URL = 'http://abdulmulafashion.com';
  assert.throws(() => validateProductionSecurity(httpEnv), /HTTPS/);

  const pathEnv = validProductionEnv();
  pathEnv.FRONTEND_URL = 'https://abdulmulafashion.com/login';
  assert.throws(() => validateProductionSecurity(pathEnv), /HTTPS origin/);
});

test('production requires independent JWT secrets of at least 32 bytes', () => {
  const shortEnv = validProductionEnv();
  shortEnv.JWT_SECRET = 'short';
  assert.throws(() => validateProductionSecurity(shortEnv), /JWT_SECRET.*32 bytes/);

  const sameEnv = validProductionEnv();
  sameEnv.JWT_REFRESH_SECRET = sameEnv.JWT_SECRET;
  assert.throws(() => validateProductionSecurity(sameEnv), /must be different/);
});
