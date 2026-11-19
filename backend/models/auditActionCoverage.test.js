const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const auditSchema = readFileSync(path.join(__dirname, 'AuditLog.js'), 'utf8');
const customerRoutes = readFileSync(path.join(__dirname, '../routes/customers.js'), 'utf8');
const invoiceRoutes = readFileSync(path.join(__dirname, '../routes/invoices.js'), 'utf8');

test('AuditLog schema accepts every action emitted by application routes', () => {
  const actions = [
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
    'INVOICE_CREATE', 'INVOICE_DELETE',
    'OFFLINE_CONFLICT_APPROVE', 'OFFLINE_CONFLICT_REJECT',
    'EXPENSE_CREATE', 'EXPENSE_DELETE',
    'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'CUSTOMER_CREDIT_REPAYMENT',
    'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DELETE', 'SUPPLIER_PAYMENT',
    'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_UPDATE', 'PURCHASE_ORDER_DELETE',
    'PURCHASE_ORDER_ORDERED', 'PURCHASE_ORDER_RECEIVE',
    'STOCK_ADJUST', 'USER_CREATE', 'USER_UPDATE',
    'CASHBOOK_CREATE', 'CASHBOOK_CLOSING_SUBMIT', 'CASHBOOK_CLOSING_APPROVE'
  ];
  for (const action of actions) {
    assert.match(auditSchema, new RegExp(`['"]${action}['"]`), `Missing AuditLog action: ${action}`);
  }
});

test('customer credit repayment is transactional with its audit record', () => {
  assert.match(customerRoutes, /router\.post\('\/:id\/pay', protect, authorize\('admin', 'manager'\)/);
  assert.match(customerRoutes, /await session\.withTransaction\(async \(\) => \{/);
  assert.match(customerRoutes, /await customer\.save\(\{ session \}\)/);
  assert.match(customerRoutes, /await AuditLog\.create\(\[[\s\S]*?CUSTOMER_CREDIT_REPAYMENT[\s\S]*?\], \{ session \}\)/);
});

test('the retired batch sync route no longer calls an undefined helper', () => {
  assert.match(invoiceRoutes, /router\.post\('\/sync-offline', protect, \(req, res\) => \{/);
  assert.match(invoiceRoutes, /res\.status\(410\)\.json\(/);
  assert.doesNotMatch(invoiceRoutes, /createInvoiceInternal/);
});
