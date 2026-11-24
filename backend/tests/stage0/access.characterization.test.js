'use strict';
// Stage 0 characterization – audit actions (C14), financial data each role receives
// (C15), role refusals (C16) and the legacy /api/expenses/add route (C18), recorded at
// 85f341d BEFORE any Stage 0 change. Assertions after a "CHANGES at S0-x" comment are
// the ones that Stage 0 commit replaces; every other assertion must keep passing.

require('../helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./fixtures');

let m;
let users;
let data;

const inventoryCostValue = async () => (await m.Product.find({ isDeleted: false }).lean())
  .reduce((sum, product) => sum + (product.costPrice || 0) * (product.quantity || 0), 0);

test.before(async () => {
  m = await fx.startSuite();
  users = await fx.createUsers();
  const product = await fx.seedProduct({ price: 12.5, costPrice: 8, quantity: 30, barcode: 'STAGE0-0001' });
  const lowStock = await fx.seedProduct({ price: 10, costPrice: 6, quantity: 2, lowStockThreshold: 5 });
  const customer = await fx.seedCustomer();
  const supplier = await fx.seedSupplier({ debtBalance: 120 });
  const staffSale = await fx.api(users.staff).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 2 }], customer }));
  const adminSale = await fx.api(users.admin).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 1 }] }));
  const expense = await fx.api(users.admin).post('/api/expenses', { title: 'Stage 0 expense', amount: 5, category: 'Other' });
  const order = await fx.api(users.admin).post('/api/purchase-orders',
    { supplierId: String(supplier._id), items: [{ productId: String(product._id), quantity: 4, unitCost: 7 }] });
  for (const res of [staffSale, adminSale, expense, order]) assert.equal(res.status, 201);
  data = { product, lowStock, customer, supplier, adminInvoiceId: adminSale.body.data._id, orderId: order.body.data._id };
});
test.after(fx.stopSuite);

test('C14 a recursive source scan finds 33 literal audit actions, all on the list of 39 that the AuditLog schema uses; the audit helpers forward their caller\'s action (changed at S0-5a)', async t => {
  const { files, actions, labels, nonLiteral } = fx.scanAuditActions();
  const allowed = m.AuditLog.schema.path('action').enumValues;

  // The scan covers every backend application source area; tests and node_modules are excluded.
  assert.deepEqual([...new Set(files.map(file => file.split('/')[0]))],
    ['app.js', 'config', 'middleware', 'models', 'routes', 'scripts', 'server.js', 'services', 'utils']);

  // The complete inventory of audit actions written (or queried) as string literals.
  assert.deepEqual([...actions.keys()].sort(), [
    'CASHBOOK_CLOSING_APPROVE', 'CASHBOOK_CLOSING_SUBMIT', 'CASHBOOK_CREATE',
    'CUSTOMER_CREATE', 'CUSTOMER_DELETE', 'CUSTOMER_UPDATE', 'EXPENSE_CREATE', 'EXPENSE_DELETE',
    'INVITATION_CREATED', 'INVITATION_DELETED', 'INVITATION_RESENT', 'INVOICE_CREATE', 'INVOICE_DELETE',
    'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'OFFLINE_CONFLICT_APPROVE', 'OFFLINE_CONFLICT_REJECT',
    'PRODUCT_CREATE', 'PRODUCT_DELETE', 'PRODUCT_UPDATE',
    'PURCHASE_ORDER_CREATE', 'PURCHASE_ORDER_DELETE', 'PURCHASE_ORDER_ORDERED',
    'PURCHASE_ORDER_RECEIVE', 'PURCHASE_ORDER_UPDATE',
    'SUPPLIER_CREATE', 'SUPPLIER_DELETE', 'SUPPLIER_PAYMENT', 'SUPPLIER_UPDATE',
    'USER_CREATE', 'USER_CREATED_FROM_INVITATION', 'USER_UPDATE'
  ]);
  // Changed at S0-5a: every written action is in the schema (before S0-5a, 12 were missing and
  // were dropped), and the schema adds INVOICE_DELETE_REFUSED, CUSTOMER_UPDATE_REJECTED,
  // CUSTOMER_PAYMENT_RECORD, CUSTOMER_PAYMENT_REVERSE and EXCHANGE_RATE_UPDATE.
  assert.deepEqual([...actions.keys()].filter(action => !allowed.includes(action)).sort(), []);
  assert.equal(allowed.length, 39);
  // CHANGES at S0-7: STOCK_ADJUST starts being written by the stock-adjustment endpoint.
  // CHANGES at S0-5b-backend: EXCHANGE_RATE_UPDATE starts being written; the other four new
  // actions leave this list in the later Stage 0 commits that write them.
  assert.deepEqual(allowed.filter(action => !actions.has(action)), [
    'STOCK_ADJUST', 'INVOICE_DELETE_REFUSED', 'CUSTOMER_UPDATE_REJECTED',
    'CUSTOMER_PAYMENT_RECORD', 'CUSTOMER_PAYMENT_REVERSE', 'EXCHANGE_RATE_UPDATE'
  ]);

  // Lower-case literals are labels inside `details`, not audit actions.
  assert.deepEqual(labels.map(label => [label.location, label.value, label.inDetails]), [
    ['routes/auth.js:119', 'account_activated', true],
    ['routes/auth.js:170', 'password_reset_requested', true],
    ['routes/auth.js:218', 'password_reset_completed', true],
    ['routes/staff.js:244', 'password_reset_by_admin', true]
  ]);
  // Every `action` the scan cannot read as a literal. The only dynamic audit actions are log() and
  // recordAudit() forwarding their caller's value through the shared entry builder in
  // utils/auditLogger.js. No caller passes a non-literal (none is listed here), so the inventory
  // above is complete. Review any new entry before adding it.
  assert.deepEqual(nonLiteral, [
    'models/AuditLog.js:10 schema', // the field definition; its enum is the list in utils/auditActions.js
    'models/AuditLog.js:21 index', // index specification
    'routes/staff.js:268 destructuring', // audit-log list: action filter read from the query string
    'routes/staff.js:270 assignment', // the same filter applied to the query
    'utils/auditLogger.js:25 parameter', // the entry builder receives the caller's action ...
    'utils/auditLogger.js:28 shorthand', // ... and stores it: dynamic, resolved through the callers
    'utils/auditLogger.js:49 assignment' // a safe failure line copies the action only when it is on the list
  ]);

  // Behaviour: the purchase order is created and its audit entry is stored. Changed at S0-5a:
  // before S0-5a the entry failed schema validation and was reported only on the console. The
  // shared setup's order is audited too, so the count is for this order.
  const consoleError = t.mock.method(console, 'error', () => {});
  const res = await fx.api(users.admin).post('/api/purchase-orders',
    { supplierId: String(data.supplier._id), items: [{ productId: String(data.product._id), quantity: 1, unitCost: 7 }] });
  assert.equal(res.status, 201);
  assert.equal(await m.AuditLog.countDocuments({ action: 'PURCHASE_ORDER_CREATE', entityId: res.body.data._id }), 1);
  const messages = consoleError.mock.calls.map(call => call.arguments.join(' '));
  assert.ok(!messages.some(text => text.startsWith('Audit log error:')));
  assert.ok(!messages.some(text => text.includes('"event":"audit.')));
});

test('C15a staff receive cost prices, invoice unit costs, inventory value at cost, other cashiers\' sales and revenue as "profit" (changes at S0-4)', async () => {
  const staff = fx.api(users.staff);
  const productId = String(data.product._id);

  // CHANGES at S0-4: none of these cost fields reach staff, and cashiers see only their own sales
  // from the last 7 days.
  assert.equal((await staff.get('/api/products')).body.data.find(p => p._id === productId).costPrice, 8);
  assert.equal((await staff.get('/api/products?page=1&limit=50')).body.summary.inventoryCostValue, await inventoryCostValue());
  assert.equal((await staff.get(`/api/products/${productId}`)).body.data.costPrice, 8);
  assert.equal((await staff.get('/api/products/barcode/STAGE0-0001')).body.data.costPrice, 8);

  const adminInvoice = (await staff.get('/api/invoices')).body.data.find(i => i._id === data.adminInvoiceId);
  assert.equal(adminInvoice.soldBy, String(users.admin._id));
  assert.deepEqual([adminInvoice.items[0].unitCost, adminInvoice.items[0].costKnown], [8, true]);
  assert.equal((await staff.get(`/api/invoices/${data.adminInvoiceId}`)).body.data.items[0].unitCost, 8);
  assert.equal((await staff.get(`/api/customers/${data.customer._id}`)).body.invoices[0].items[0].unitCost, 8);

  const dashboard = (await staff.get('/api/dashboard')).body.data;
  assert.equal(dashboard.stats.profit, dashboard.stats.totalRevenue); // staff: expenses are not subtracted
  assert.ok(dashboard.recentInvoices.every(invoice => invoice.items.every(line => line.unitCost === 8)));
  assert.equal(dashboard.lowStock.find(p => p._id === String(data.lowStock._id)).costPrice, 6);
});

test('C15b managers and admins receive gross profit, cost of goods, inventory at cost, supplier debt and purchase unit costs (manager view changes at S0-4)', async () => {
  // CHANGES at S0-4 for managers only: revenue figures stay; gross profit, cost of goods, inventory at
  // cost, supplier debt, purchase-order costs and the dashboard profit card are removed. Admins keep them.
  for (const role of ['manager', 'admin']) {
    const client = fx.api(users[role]);
    const summary = (await client.get('/api/reports/summary')).body.data;
    assert.deepEqual(
      [summary.grossProfitAvailable, summary.netSales, summary.costOfGoodsSold, summary.grossProfit, summary.totalSupplierDebt],
      [true, 37.5, 24, 13.5, 120], role);
    const inventory = (await client.get('/api/reports/inventory')).body.data;
    assert.equal(inventory.inventoryValue.atCost, await inventoryCostValue(), role);
    assert.equal(inventory.lowStock.find(p => p._id === String(data.lowStock._id)).costPrice, 6, role);
    assert.equal((await client.get('/api/suppliers')).body.data.find(s => s._id === String(data.supplier._id)).debtBalance, 120, role);
    assert.equal((await client.get('/api/suppliers?page=1&limit=50')).body.summary.totalDebt, 120, role);
    assert.equal((await client.get('/api/purchase-orders')).body.data.find(o => o._id === data.orderId).items[0].unitCost, 7, role);
    const { stats } = (await client.get('/api/dashboard')).body.data;
    assert.equal(stats.profit, stats.totalRevenue - stats.totalExpenses, role);
  }
});

test('C16 current role refusals (403) for staff and managers; managers can still create purchase orders (changes at S0-4)', async () => {
  const anyId = fx.objectId();
  const refused = [
    ['staff', 'get', '/api/reports/summary'],
    ['staff', 'get', '/api/suppliers'],
    ['staff', 'get', '/api/purchase-orders'],
    ['staff', 'get', '/api/cashbook/today'],
    ['staff', 'get', '/api/expenses'],
    ['staff', 'post', '/api/products'],
    ['staff', 'put', `/api/products/${anyId}`],
    ['staff', 'get', `/api/products/${anyId}/movements`],
    ['staff', 'post', '/api/invoices/offline-conflicts/approve'],
    ['staff', 'get', '/api/staff/system/audit-logs'],
    ['manager', 'post', `/api/cashbook/approve/${anyId}`],
    ['manager', 'put', `/api/purchase-orders/${anyId}`],
    ['manager', 'delete', `/api/purchase-orders/${anyId}`],
    ['manager', 'delete', `/api/suppliers/${anyId}`],
    ['manager', 'post', '/api/staff'],
    ['manager', 'get', '/api/staff/system/audit-logs']
  ];
  for (const [role, method, url] of refused) {
    assert.equal((await fx.api(users[role])[method](url)).status, 403, `${role} ${method.toUpperCase()} ${url}`);
  }

  // CHANGES at S0-4: purchase-order creation (and supplier payment) become admin-only.
  const created = await fx.api(users.manager).post('/api/purchase-orders',
    { supplierId: String(data.supplier._id), items: [{ productId: String(data.product._id), quantity: 1, unitCost: 7 }] });
  assert.equal(created.status, 201);
});

test('C18 POST /api/expenses/add is registered and re-dispatches into its own router (inspected, never requested; changes at S0-8, T-3)', () => {
  const expensesRouter = fx.loadRoute('expenses'); // the same cached instance the app uses
  const layer = expensesRouter.stack.find(entry => entry.route?.path === '/add');
  // CHANGES at S0-8 (T-3): the route is removed, so the request reaches the API's 404 handler.
  assert.ok(layer, 'the /add route is registered');
  assert.equal(layer.route.methods.post, true);
  assert.match(layer.route.stack.at(-1).handle.toString(), /router\.handle\(req, res, next\)/);
  const mount = fx.app()._router.stack.find(entry => entry.handle === expensesRouter);
  assert.ok(mount.regexp.test('/api/expenses/add'));
  // Stays after S0-8: no frontend file calls the route.
  assert.deepEqual(fx.findFrontendReferences('expenses/add'), []);
});
