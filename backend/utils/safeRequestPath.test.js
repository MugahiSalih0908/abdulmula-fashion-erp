const test = require('node:test');
const assert = require('node:assert/strict');
const { redactRequestPath } = require('./safeRequestPath');

test('redacts activation tokens from access log paths', () => {
  assert.equal(redactRequestPath({ path: '/api/auth/activate/secret-token' }), '/api/auth/activate/[REDACTED]');
});

test('redacts password reset tokens from access log paths', () => {
  assert.equal(redactRequestPath({ path: '/api/auth/reset-password/secret-token' }), '/api/auth/reset-password/[REDACTED]');
});

test('redacts invitation validation and acceptance tokens', () => {
  assert.equal(redactRequestPath({ path: '/api/invitations/validate/abc' }), '/api/invitations/validate/[REDACTED]');
  assert.equal(redactRequestPath({ path: '/api/invitations/accept/abc' }), '/api/invitations/accept/[REDACTED]');
});

test('removes query strings before logging', () => {
  assert.equal(redactRequestPath({ originalUrl: '/api/email-logs?recipient=private@example.com' }), '/api/email-logs');
});

test('preserves ordinary route paths', () => {
  assert.equal(redactRequestPath({ path: '/api/products' }), '/api/products');
});
