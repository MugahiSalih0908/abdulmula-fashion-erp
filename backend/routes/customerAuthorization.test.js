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

test('customer edits cannot overwrite accounting fields through mass assignment', () => {
  assert.match(customerRoutes, /for \(const field of \['name', 'phone', 'email', 'address', 'notes'\]\)/);
  assert.match(customerRoutes, /\{ \$set: updates \}/);
  assert.doesNotMatch(customerRoutes, /findOneAndUpdate\([\s\S]{0,160}req\.body/);
});

test('customer credit repayment is manager/admin-only and audited', () => {
  assert.match(customerRoutes, /router\.post\('\/:id\/pay', protect, authorize\('admin', 'manager'\)/);
  assert.match(customerRoutes, /action: 'CUSTOMER_CREDIT_REPAYMENT'/);
});
