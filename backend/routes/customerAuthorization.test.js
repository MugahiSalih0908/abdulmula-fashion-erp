const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const customerRoutes = readFileSync(path.join(__dirname, 'customers.js'), 'utf8');

test('staff customer details include only that staff member’s own invoice history', () => {
  assert.match(
    customerRoutes,
    /const invoiceFilter = \{ customer: req\.params\.id \};[\s\S]*?invoiceFilter\.soldBy = req\.user\._id;[\s\S]*?Invoice\.find\(invoiceFilter\)/
  );
});
