const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedConfiguredOrigin, mustRejectInsecureRequest } = require('./transportSecurity');

test('production accepts only exact HTTPS origins', () => {
  assert.equal(isAllowedConfiguredOrigin('https://abdulmulafashion.com', { production: true }), true);
  assert.equal(isAllowedConfiguredOrigin('http://abdulmulafashion.com', { production: true }), false);
  assert.equal(isAllowedConfiguredOrigin('https://user:pass@example.com', { production: true }), false);
  assert.equal(isAllowedConfiguredOrigin('https://example.com/path', { production: true }), false);
});

test('development permits HTTP only for loopback hosts', () => {
  assert.equal(isAllowedConfiguredOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedConfiguredOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isAllowedConfiguredOrigin('http://example.com'), false);
});

test('production rejects requests without verified HTTPS at the trusted proxy', () => {
  assert.equal(mustRejectInsecureRequest({ secure: false }, true), true);
  assert.equal(mustRejectInsecureRequest({ secure: true }, true), false);
  assert.equal(mustRejectInsecureRequest({ secure: false }, false), false);
});
