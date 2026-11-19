const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionJwtSecrets } = require('./securityConfig');

const validSecrets = () => ({
  NODE_ENV: 'production',
  JWT_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
});

test('development does not require production JWT secrets', () => {
  assert.equal(validateProductionJwtSecrets({ NODE_ENV: 'development' }), true);
});

test('production accepts separate long JWT secrets', () => {
  assert.equal(validateProductionJwtSecrets(validSecrets()), true);
});

test('production rejects missing or short JWT secrets', () => {
  const missing = validSecrets();
  delete missing.JWT_SECRET;
  assert.throws(() => validateProductionJwtSecrets(missing), /JWT_SECRET.*32 bytes/);

  const short = validSecrets();
  short.JWT_REFRESH_SECRET = 'short';
  assert.throws(() => validateProductionJwtSecrets(short), /JWT_REFRESH_SECRET.*32 bytes/);
});

test('production rejects low-diversity JWT secrets', () => {
  const weak = validSecrets();
  weak.JWT_SECRET = 'a'.repeat(64);
  assert.throws(() => validateProductionJwtSecrets(weak), /sufficiently varied/);
});

test('production rejects reuse of the same JWT secret', () => {
  const reused = validSecrets();
  reused.JWT_REFRESH_SECRET = reused.JWT_SECRET;
  assert.throws(() => validateProductionJwtSecrets(reused), /must be different/);
});
