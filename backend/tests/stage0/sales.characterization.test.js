'use strict';
// Stage 0 characterization – online sale creation (C1–C6) and the unused
// /api/invoices/sync-offline endpoint (C9). These tests record behaviour at 85f341d
// BEFORE any Stage 0 change. Assertions after a "CHANGES at S0-x" comment are the ones
// that Stage 0 commit replaces; every other assertion must keep passing.

require('../helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./fixtures');

let m;
let users;
const nextInvoiceNumber = async () =>
  `INV-20261123-${String((await m.Invoice.countDocuments()) + 1).padStart(4, '0')}`;

test.before(async () => {
  m = await fx.startSuite();
  users = await fx.createUsers();
});
test.after(fx.stopSuite);

test('C1 staff cash sale with an offline ID: 201, stock reduced, one movement, one INVOICE_CREATE, one consumed decision (number changes at S0-6)', async () => {
  const product = await fx.seedProduct({ price: 12.5, costPrice: 8, quantity: 10 });
  const expectedNumber = await nextInvoiceNumber();
  const sale = fx.posSale({ lines: [{ product, quantity: 3 }] });

  const res = await fx.api(users.staff).post('/api/invoices', sale);

  assert.equal(res.status, 201);
  const invoice = res.body.data;
  // CHANGES at S0-6: atomic shop/year counter, e.g. KK1-2026-000001.
  assert.equal(invoice.invoiceNumber, expectedNumber);
  assert.deepEqual(
    [invoice.grandTotal, invoice.amountPaid, invoice.balanceDue, invoice.paymentStatus, invoice.soldBy],
    [37.5, 37.5, 0, 'paid', String(users.staff._id)]
  );
  // Cost snapshot from the server product record. CHANGES at S0-4: not returned to staff.
  assert.deepEqual([invoice.items[0].unitCost, invoice.items[0].costKnown], [8, true]);
  assert.equal((await m.Product.findById(product._id)).quantity, 7);
  const movements = await m.StockMovement.find({ product: product._id }).lean();
  assert.deepEqual(movements.map(x => [x.type, x.quantity, x.before, x.after, x.reference]),
    [['sale', -3, 10, 7, invoice.invoiceNumber]]);
  assert.equal(await m.AuditLog.countDocuments({ action: 'INVOICE_CREATE', entityId: invoice._id }), 1);
  const decisions = await m.OfflineConflictDecision.find({ offlineId: sale.offlineId }).lean();
  assert.deepEqual(decisions.map(d => [d.state, d.decisionType, String(d.invoice)]),
    [['consumed', 'accepted', invoice._id]]);
});

test('C2 an identical repeat returns 200 duplicate with the original invoice and repeats no effect', async () => {
  const product = await fx.seedProduct({ quantity: 10 });
  const sale = fx.posSale({ lines: [{ product, quantity: 2 }] });
  const first = await fx.api(users.staff).post('/api/invoices', sale);
  assert.equal(first.status, 201);

  const repeat = await fx.api(users.staff).post('/api/invoices', sale);

  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.duplicate, true);
  assert.deepEqual([repeat.body.data._id, repeat.body.data.invoiceNumber],
    [first.body.data._id, first.body.data.invoiceNumber]);
  assert.equal(await m.Invoice.countDocuments({ offlineId: sale.offlineId }), 1);
  assert.equal((await m.Product.findById(product._id)).quantity, 8);
  assert.equal(await m.StockMovement.countDocuments({ product: product._id }), 1);
  assert.equal(await m.AuditLog.countDocuments({ action: 'INVOICE_CREATE', entityId: first.body.data._id }), 1);
});

test('C3 the same offline ID with a changed payload is refused with 409 and writes nothing new', async () => {
  const product = await fx.seedProduct({ quantity: 10 });
  const sale = fx.posSale({ lines: [{ product, quantity: 2 }] });
  assert.equal((await fx.api(users.staff).post('/api/invoices', sale)).status, 201);
  const changed = { ...sale, items: [{ ...sale.items[0], quantity: 3 }] };

  const res = await fx.api(users.staff).post('/api/invoices', changed);

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'OFFLINE_IDENTITY_CONFLICT');
  assert.equal(await m.Invoice.countDocuments({ offlineId: sale.offlineId }), 1);
  assert.equal((await m.Product.findById(product._id)).quantity, 8);
  assert.equal(await m.StockMovement.countDocuments({ product: product._id }), 1);
});

test('C4 insufficient stock, also across two lines of one product, is refused with 400 and nothing is written', async () => {
  const product = await fx.seedProduct({ quantity: 2 });
  const invoicesBefore = await m.Invoice.countDocuments();
  const cases = [
    { lines: [{ product, quantity: 3 }], available: 2 },
    { lines: [{ product, quantity: 2 }, { product, quantity: 1 }], available: 0 }
  ];

  for (const { lines, available } of cases) {
    const sale = fx.posSale({ lines });
    const res = await fx.api(users.staff).post('/api/invoices', sale);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, `Insufficient stock for "${product.name}". Available: ${available}`);
    assert.equal(await m.OfflineConflictDecision.countDocuments({ offlineId: sale.offlineId }), 0);
  }
  assert.equal(await m.Invoice.countDocuments(), invoicesBefore);
  assert.equal((await m.Product.findById(product._id)).quantity, 2);
  assert.equal(await m.StockMovement.countDocuments({ product: product._id }), 0);
});

test('C5 credit sale: nothing paid; the whole total is added to the customer balance and purchases', async () => {
  const product = await fx.seedProduct({ price: 40, quantity: 10 });
  const customer = await fx.seedCustomer();

  const res = await fx.api(users.staff).post('/api/invoices',
    fx.posSale({ lines: [{ product, quantity: 2 }], paymentMethod: 'Credit', customer }));

  assert.equal(res.status, 201);
  const { amountPaid, balanceDue, paymentStatus, customerPurchaseRecorded } = res.body.data;
  assert.deepEqual({ amountPaid, balanceDue, paymentStatus, customerPurchaseRecorded },
    { amountPaid: 0, balanceDue: 80, paymentStatus: 'unpaid', customerPurchaseRecorded: true });
  const stored = await m.Customer.findById(customer._id).lean();
  assert.deepEqual([stored.creditBalance, stored.totalPurchases], [80, 80]);
});

test('C6 an existing invoice holding the next count-based number makes the sale fail with 400 and write nothing (changes at S0-6)', async () => {
  const product = await fx.seedProduct({ quantity: 10 });
  // The pre-save hook numbers an invoice as (all invoices + 1). Seed one synthetic invoice
  // that already holds the number the next sale will compute: the state a deletion leaves.
  const collidingNumber = `INV-20261123-${String((await m.Invoice.countDocuments()) + 2).padStart(4, '0')}`;
  await m.Invoice.create({ invoiceNumber: collidingNumber, items: [], subtotal: 0, grandTotal: 0, soldByName: 'Stage 0 synthetic' });
  const sale = fx.posSale({ lines: [{ product, quantity: 1 }] });

  const res = await fx.api(users.staff).post('/api/invoices', sale);

  // CHANGES at S0-6: counters ignore the document count, so this sale succeeds.
  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'InvoiceNumber already exists.');
  assert.equal(await m.Invoice.countDocuments({ offlineId: sale.offlineId }), 0);
  assert.equal(await m.OfflineConflictDecision.countDocuments({ offlineId: sale.offlineId }), 0);
  assert.equal((await m.Product.findById(product._id)).quantity, 10);
  assert.equal(await m.StockMovement.countDocuments({ product: product._id }), 0);
});

test('C9 POST /api/invoices/sync-offline answers 200 with a per-item failure and creates nothing (changes at S0-8)', async () => {
  const product = await fx.seedProduct({ quantity: 5 });
  const invoicesBefore = await m.Invoice.countDocuments();
  const queued = fx.posSale({ lines: [{ product, quantity: 1 }] });

  const res = await fx.api(users.staff).post('/api/invoices/sync-offline', { invoices: [queued] });
  const empty = await fx.api(users.staff).post('/api/invoices/sync-offline', { invoices: [] });

  // CHANGES at S0-8: the route is removed; both requests get the API's 404 JSON.
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    success: true,
    data: [{ offlineId: queued.offlineId, success: false, error: 'createInvoiceInternal is not defined' }]
  });
  assert.deepEqual([empty.status, empty.body.message], [400, 'No invoices to sync.']);
  assert.equal(await m.Invoice.countDocuments(), invoicesBefore);
  assert.equal((await m.Product.findById(product._id)).quantity, 5);
  // Stays after S0-8: no frontend file references the endpoint.
  assert.deepEqual(fx.findFrontendReferences('sync-offline'), []);
});
