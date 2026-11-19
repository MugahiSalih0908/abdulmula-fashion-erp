const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = relativePath => readFileSync(path.join(__dirname, relativePath), 'utf8');

test('invoice deletion is restricted to administrators and managers', () => {
  const routes = read('./invoices.js');
  assert.match(routes, /router\.delete\('\/:id',\s*protect,\s*authorize\('admin',\s*'manager'\)/);
});

test('customer profile updates whitelist profile fields only', () => {
  const routes = read('./customers.js');
  const start = routes.indexOf("router.put('/:id'");
  const end = routes.indexOf("router.post('/:id/pay'", start);
  const updateRoute = routes.slice(start, end);

  assert.match(updateRoute, /allowedFields = \['name', 'phone', 'email', 'address', 'notes'\]/);
  assert.match(updateRoute, /findOneAndUpdate\([\s\S]*?updates/);
  assert.doesNotMatch(updateRoute, /findOneAndUpdate\([\s\S]*?req\.body/);
});

test('supplier profile updates cannot change debt balances or deletion state', () => {
  const routes = read('./suppliers.js');
  const start = routes.indexOf("router.put('/:id'");
  const end = routes.indexOf("router.delete('/:id'", start);
  const updateRoute = routes.slice(start, end);

  assert.match(updateRoute, /allowedFields = \['name', 'phone', 'email', 'address', 'company', 'notes'\]/);
  assert.match(updateRoute, /findOneAndUpdate\([\s\S]*?updates/);
  assert.doesNotMatch(updateRoute, /findOneAndUpdate\([\s\S]*?req\.body/);
});

test('login, invitation activation, refresh rotation and logout hash refresh tokens', () => {
  const auth = read('./auth.js');
  const invitations = read('./invitations.js');
  const loginStart = auth.indexOf("router.post('/login'");
  const loginEnd = auth.indexOf("router.post('/activate/'", loginStart);
  const loginRoute = auth.slice(loginStart, loginEnd);
  const refreshStart = auth.indexOf("router.post('/refresh'");
  const logoutStart = auth.indexOf("router.post('/logout'", refreshStart);
  const refreshRoute = auth.slice(refreshStart, logoutStart);
  const logoutRoute = auth.slice(logoutStart, auth.indexOf("router.post('/logout-all'", logoutStart));

  assert.match(loginRoute, /refreshTokens\.push\(hashRefreshToken\(refreshToken\)\)/);
  assert.match(refreshRoute, /hashRefreshToken\(refreshToken\)/);
  assert.match(refreshRoute, /hashRefreshToken\(newRefresh\)/);
  assert.match(logoutRoute, /hashRefreshToken\(refreshToken\)/);
  assert.match(invitations, /refreshTokens = \[hashRefreshToken\(refreshToken\)\]/);
});
