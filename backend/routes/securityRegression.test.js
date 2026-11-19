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


test('staff product reads do not expose cost prices or inventory valuation', () => {
  const routes = read('./products.js');
  assert.match(routes, /if \(isManager\) productFields\.push\('costPrice'\)/);
  assert.match(routes, /if \(!isManager\) findQuery\.select\('-costPrice'\)/);
  assert.match(routes, /if \(req\.user\.role === 'staff'\) productQuery\.select\('-costPrice'\)/);
  assert.match(routes, /if \(safeSummary\.inventoryCostValue === undefined\) delete safeSummary\.inventoryCostValue/);
});

test('staff invoice list and detail endpoints are scoped to the signed-in salesperson', () => {
  const routes = read('./invoices.js');
  assert.match(routes, /req\.user\.role === 'staff' \? \{ soldBy: req\.user\._id \} : \{\}/);
  assert.match(routes, /_id: req\.params\.id,[\s\S]*?soldBy: req\.user\._id/);
});

test('staff dashboard sales and recent invoices are scoped to the signed-in salesperson', () => {
  const routes = read('./dashboard.js');
  assert.match(routes, /const invoiceScope = isManager \? \{\} : \{ soldBy: req\.user\._id \}/);
  assert.match(routes, /Invoice\.find\(invoiceScope\)/);
  assert.match(routes, /\$match: invoiceScope/);
});

test('manager staff directory projection does not include salary or login IP metadata', () => {
  const routes = read('./staff.js');
  assert.match(routes, /req\.user\.role === 'admin'[\s\S]*?'name email role isActive isVerified salary lastLogin createdAt updatedAt'[\s\S]*?: 'name email role isActive isVerified lastLogin createdAt updatedAt'/);
});

test('production API configuration requires HTTPS and account recovery routes are throttled', () => {
  const client = read('../../frontend/src/services/api.js');
  const server = read('../server.js');
  assert.match(client, /import\.meta\.env\.PROD/);
  assert.match(client, /productionApiUrl\.protocol !== 'https:'/);
  assert.match(server, /process\.env\.NODE_ENV === 'production' && url\.protocol !== 'https:'/);
  for (const endpoint of ['forgot-password', 'reset-password', 'activate', 'refresh']) {
    assert.ok(server.includes(`app.use('/api/auth/${endpoint}'`), `Missing rate limit for ${endpoint}`);
  }
});
