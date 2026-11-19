const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const products = readFileSync(path.join(__dirname, 'products.js'), 'utf8');
const invoices = readFileSync(path.join(__dirname, 'invoices.js'), 'utf8');
const dashboard = readFileSync(path.join(__dirname, 'dashboard.js'), 'utf8');

test('cashiers do not receive product cost, supplier, or inventory cost totals', () => {
  assert.match(products, /const canViewProductCosts = role => \['admin', 'manager'\]\.includes\(role\)/);
  assert.match(products, /findQuery\.select\('-costPrice -supplier'\)/);
  assert.match(products, /productQuery\.select\('-costPrice -supplier'\)/);
  assert.match(products, /if \(summary && !mayViewCosts\) delete summary\.inventoryCostValue/);
});

test('cashiers do not receive unit cost snapshots from invoice responses', () => {
  assert.match(invoices, /items\.map\(\(\{ unitCost, costKnown, \.\.\.item \}\) => item\)/);
  assert.match(invoices, /invoiceForRole\(result\.invoice, req\.user\.role\)/);
  assert.match(invoices, /invoices\.map\(invoice => invoiceForRole\(invoice, req\.user\.role\)\)/);
  assert.match(invoices, /data: invoiceForRole\(invoice, req\.user\.role\)/);
});

test('offline duplicate invoice responses cannot cross cashier accounts', () => {
  assert.match(invoices, /String\(existingInvoice\.soldBy\) !== String\(req\.user\._id\)/);
  assert.match(invoices, /This offline sale ID is already assigned to another staff account/);
});

test('cashier dashboard does not include supplier or product cost data', () => {
  assert.match(dashboard, /-items\.unitCost -items\.costKnown/);
  assert.match(dashboard, /-costPrice -supplier/);
});
