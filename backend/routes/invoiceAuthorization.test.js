const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const invoiceRoutes = readFileSync(path.join(__dirname, 'invoices.js'), 'utf8');

test('only admins and managers can delete invoices', () => {
  assert.match(
    invoiceRoutes,
    /router\.delete\('\/:id',\s*protect,\s*authorize\('admin',\s*'manager'\)/
  );
});

test('staff invoice history is scoped to invoices they created', () => {
  assert.match(
    invoiceRoutes,
    /if \(!\['admin', 'manager'\]\.includes\(req\.user\.role\)\)\s*\{\s*filter\.soldBy = req\.user\._id;/
  );
});

test('staff cannot fetch another employee invoice by its identifier', () => {
  assert.match(
    invoiceRoutes,
    /const invoiceFilter = \{ _id: req\.params\.id \};[\s\S]*?invoiceFilter\.soldBy = req\.user\._id;[\s\S]*?Invoice\.findOne\(invoiceFilter\)/
  );
});
