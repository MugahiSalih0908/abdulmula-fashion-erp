const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const dashboardRoutes = readFileSync(path.join(__dirname, 'dashboard.js'), 'utf8');

test('dashboard defines a shop-wide scope only for admin and manager', () => {
  assert.match(
    dashboardRoutes,
    /const invoiceScope = isManager \? \{\} : \{ soldBy: req\.user\._id \};/
  );
});

test('dashboard invoice totals, recent invoices and trends apply the employee scope', () => {
  assert.match(dashboardRoutes, /Invoice\.aggregate\(\[\{ \$match: invoiceScope \}/);
  assert.match(dashboardRoutes, /Invoice\.find\(invoiceScope\)/);
  assert.match(dashboardRoutes, /\$match:\{ \.\.\.invoiceScope, date:/);
});
