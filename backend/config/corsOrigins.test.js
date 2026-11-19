const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedBrowserOrigin } = require('./corsOrigins');

const productionOrigins = [
  'https://abdulmulafashion.com',
  'https://abdulmula-fashion-erp-git-security-au-4704ed-mugahid-s-projects.vercel.app'
];

test('production accepts only exact configured origins', () => {
  for (const origin of productionOrigins) {
    assert.equal(isAllowedBrowserOrigin({
      origin,
      allowedOrigins: productionOrigins,
      isProduction: true
    }), true);
  }

  assert.equal(isAllowedBrowserOrigin({
    origin: 'https://abdulmula-fashion-erp-git-untrusted-mugahid-s-projects.vercel.app',
    allowedOrigins: productionOrigins,
    isProduction: true
  }), false);
  assert.equal(isAllowedBrowserOrigin({
    origin: 'https://attacker.example',
    allowedOrigins: productionOrigins,
    isProduction: true
  }), false);
});

test('localhost is allowed only in development', () => {
  assert.equal(isAllowedBrowserOrigin({
    origin: 'http://localhost:5173',
    allowedOrigins: [],
    isProduction: false
  }), true);

  assert.equal(isAllowedBrowserOrigin({
    origin: 'http://localhost:5173',
    allowedOrigins: [],
    isProduction: true
  }), false);
});

test('non-browser requests without an Origin remain supported', () => {
  assert.equal(isAllowedBrowserOrigin({
    origin: undefined,
    allowedOrigins: [],
    isProduction: true
  }), true);
});
