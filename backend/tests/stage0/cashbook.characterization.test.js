'use strict';
// Stage 0 characterization – cash closing (C13, C22) and expenses on finalized days
// (C19, C20), recorded at 85f341d BEFORE any Stage 0 change. Each test runs on its own
// frozen business day (UTC). Assertions after a "CHANGES at S0-x" comment are the ones
// that Stage 0 commit replaces; every other assertion must keep passing.

require('../helpers/harness'); // must be first: applies isolation guards

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./fixtures');

let m;
let users;

test.before(async () => {
  m = await fx.startSuite();
  users = await fx.createUsers();
});
test.after(fx.stopSuite);

const openToday = async () => {
  const res = await fx.api(users.admin).post('/api/cashbook/open');
  assert.equal(res.status, 201);
  return res.body.data;
};

const closeAndApproveToday = async actualCash => {
  const closed = await fx.api(users.admin).post('/api/cashbook/close', { actualCash });
  assert.equal(closed.status, 200);
  const approved = await fx.api(users.admin).post(`/api/cashbook/approve/${closed.body.data._id}`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'approved');
  return approved.body.data;
};

test('C13 expected cash = opening + Cash invoices − all expenses − cash supplier payments: 520 today, 600 after S0-3', async () => {
  fx.setClock('2026-11-23T10:00:00.000Z');
  await m.CashBook.create({ date: '2026-11-22', openingCash: 0, closingCash: 100, isClosed: true });
  assert.equal((await openToday()).openingCash, 100);

  const item = await fx.seedProduct({ price: 100, costPrice: 60, quantity: 50 });
  const mixedItem = await fx.seedProduct({ price: 50, costPrice: 30, quantity: 10 });
  const customer = await fx.seedCustomer();
  const sales = [
    fx.posSale({ lines: [{ product: item, quantity: 5 }], paymentMethod: 'Cash' }), // 500
    fx.posSale({ lines: [{ product: item, quantity: 2 }], paymentMethod: 'Mobile Transfer' }), // 200
    fx.posSale({ lines: [{ product: item, quantity: 3 }], paymentMethod: 'Credit', customer }), // 300
    fx.posSale({ lines: [{ product: mixedItem, quantity: 3 }], paymentMethod: 'Mixed' }) // 150
  ];
  for (const sale of sales) assert.equal((await fx.api(users.staff).post('/api/invoices', sale)).status, 201);
  assert.equal((await fx.api(users.admin).post('/api/expenses',
    { title: 'Stage 0 transport', amount: 30, category: 'Transport' })).status, 201);

  // Cash supplier payment of 50 through the purchase-order workflow.
  const supplier = await fx.seedSupplier();
  const poItem = await fx.seedProduct({ price: 70, costPrice: 40, quantity: 0 });
  const order = await fx.api(users.admin).post('/api/purchase-orders',
    { supplierId: String(supplier._id), items: [{ productId: String(poItem._id), quantity: 1, unitCost: 50 }] });
  assert.equal(order.status, 201);
  const orderPath = `/api/purchase-orders/${order.body.data._id}`;
  assert.equal((await fx.api(users.admin).patch(`${orderPath}/order`)).status, 200);
  assert.equal((await fx.api(users.admin).patch(`${orderPath}/receive`)).status, 200);
  assert.equal((await fx.api(users.admin).patch(`${orderPath}/pay`, { amount: 50, paymentMethod: 'Cash' })).status, 200);

  // Cash repayment of 80 by the credit customer.
  assert.equal((await fx.api(users.staff).post(`/api/customers/${customer._id}/pay`, { amount: 80 })).status, 200);

  const res = await fx.api(users.admin).post('/api/cashbook/close', { actualCash: 600 });

  assert.equal(res.status, 200);
  const { expectedCash, totalSales, totalExpenses, supplierCashPayments, excess, shortage, status } = res.body.data;
  // CHANGES at S0-3: expected cash adds the 80 cash repayment (600 here), non-cash repayments are
  // reported separately, and Cash invoices count the amount actually paid (S0-D).
  assert.deepEqual({ expectedCash, excess, shortage }, { expectedCash: 520, excess: 80, shortage: 0 });
  assert.deepEqual({ totalSales, totalExpenses, supplierCashPayments, status },
    { totalSales: 500, totalExpenses: 30, supplierCashPayments: 50, status: 'pending_approval' });
  // Changed at S0-5a: CASHBOOK_CLOSING_SUBMIT is in the audit schema (C14), so log() stores it.
  // CHANGES at S0-5b-backend: stored inside the closing transaction.
  assert.equal(await m.AuditLog.countDocuments({ action: 'CASHBOOK_CLOSING_SUBMIT' }), 1);
});

test('C19 expenses dated on an approved day are accepted, changing its live and reported totals (changes at S0-3, T-6)', async () => {
  fx.setClock('2026-11-24T10:00:00.000Z');
  await openToday();
  await closeAndApproveToday(0);

  const sameDay = await fx.api(users.manager).post('/api/expenses',
    { title: 'Stage 0 same-day expense', amount: 25, category: 'Other' });
  // CHANGES at S0-3 (T-6): refused with 409 because the day is closed.
  assert.equal(sameDay.status, 201);
  const today = (await fx.api(users.admin).get('/api/cashbook/today')).body.data;
  assert.deepEqual([today.isClosed, today.liveExpenses], [true, 25]);
  const closings = (await fx.api(users.admin).get('/api/cashbook/closings')).body.data;
  assert.equal(closings.find(c => c.date === '2026-11-24').totalExpenses, 0); // the approved record is unchanged

  fx.setClock('2026-11-25T10:00:00.000Z');
  const backdated = await fx.api(users.manager).post('/api/expenses',
    { title: 'Stage 0 backdated expense', amount: 40, category: 'Other', date: '2026-11-24T09:00:00.000Z' });
  // CHANGES at S0-3 (T-6): refused with 409.
  assert.equal(backdated.status, 201);
  const daily = (await fx.api(users.admin).get('/api/reports/daily')).body.data;
  assert.equal(daily.expByDay.find(d => d._id === '2026-11-24').total, 65);
});

test('C20 an expense can be deleted from an approved day, changing the day after approval (changes at S0-3, T-6)', async () => {
  fx.setClock('2026-11-26T10:00:00.000Z');
  await openToday();
  const expense = await fx.api(users.manager).post('/api/expenses',
    { title: 'Stage 0 expense to delete', amount: 20, category: 'Other' });
  assert.equal(expense.status, 201);
  const approved = await closeAndApproveToday(0);
  assert.equal(approved.totalExpenses, 20);

  const res = await fx.api(users.manager).delete(`/api/expenses/${expense.body.data._id}`);

  // CHANGES at S0-3 (T-6): refused with 409; the expense and the approved closing stay as recorded.
  assert.equal(res.status, 200);
  assert.equal(await m.Expense.countDocuments({ _id: expense.body.data._id }), 0);
  assert.equal((await fx.api(users.admin).get('/api/cashbook/today')).body.data.liveExpenses, 0);
  assert.equal(await m.AuditLog.countDocuments({ action: 'EXPENSE_DELETE', entityId: expense.body.data._id }), 1);
  assert.equal((await m.CashClosing.findOne({ date: '2026-11-26' })).totalExpenses, 20);
});

test('C22 partly paid Cash invoice (sales value 100, received 40, owed 60): expected cash uses 100 today; after S0-3 (S0-D) expected drawer cash is 40 and the sales value stays 100', async () => {
  fx.setClock('2026-12-01T10:00:00.000Z');
  await m.CashBook.create({ date: '2026-11-30', openingCash: 0, closingCash: 0, isClosed: true });
  assert.equal((await openToday()).openingCash, 0);
  const product = await fx.seedProduct({ price: 100, costPrice: 60, quantity: 5 });
  const customer = await fx.seedCustomer();
  // A direct API request: the current POS never sends amountPaid online and always sends
  // cashReceived for Cash, so it cannot create this invoice itself.
  const sale = { ...fx.posSale({ lines: [{ product, quantity: 1 }], paymentMethod: 'Cash', customer }), amountPaid: 40 };
  delete sale.cashReceived;

  const created = await fx.api(users.staff).post('/api/invoices', sale);

  // Stays: the invoice records sales value 100, cash received 40 and balance owed 60. The 60 is added
  // to the customer's balance: it is owed, not drawer cash.
  assert.equal(created.status, 201);
  const { grandTotal, amountPaid, balanceDue, paymentStatus } = created.body.data;
  assert.deepEqual({ grandTotal, amountPaid, balanceDue, paymentStatus },
    { grandTotal: 100, amountPaid: 40, balanceDue: 60, paymentStatus: 'partial' });
  assert.equal((await m.Customer.findById(customer._id)).creditBalance, 60);

  // Stays: livesCashSales (GET /api/cashbook/today, shown as "Cash sales" on the cash-closing page)
  // is the sales value of Cash invoices.
  assert.equal((await fx.api(users.admin).get('/api/cashbook/today')).body.data.livesCashSales, 100);

  const closed = await fx.api(users.admin).post('/api/cashbook/close', { actualCash: 40 });

  assert.equal(closed.status, 200);
  const closing = closed.body.data;
  // Stays: totalSales on the closing record is the sales value of Cash invoices.
  assert.equal(closing.totalSales, 100);
  // Today the closing has no figure for cash actually received, so expected cash uses the sales value.
  // CHANGES at S0-3 (S0-D): the closing and the live snapshot also report the 40 actually received, in
  // a separate field named in that commit, and expected drawer cash uses it: expectedCash 40
  // (opening 0 + 40 received), shortage 0 and excess 0 for a count of 40. The shared money
  // calculations in shared/invoiceCalculations.mjs do not change.
  assert.deepEqual(Object.keys(closing).filter(key => /receiv/i.test(key)), []);
  assert.deepEqual([closing.expectedCash, closing.shortage, closing.excess], [100, 60, 0]);
});
