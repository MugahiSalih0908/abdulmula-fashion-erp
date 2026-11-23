'use strict';
// Stage 0 characterization – invoice deletion (C7, C8, C21), product stock edits and
// products without a cost (C10, C23), customer updates and repayments (C11, C12) and
// supplier updates and payments (C17, C24), recorded at 85f341d BEFORE any Stage 0
// change. Assertions after a "CHANGES at S0-x" comment are the ones that Stage 0
// commit replaces; every other assertion must keep passing.

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

// Everything an invoice deletion can change, read immediately before and after the attempt.
const saleState = async ({ invoice, product, customer }) => {
  const buyer = customer ? await m.Customer.findById(customer._id).lean() : null;
  return {
    invoiceExists: (await m.Invoice.countDocuments({ _id: invoice._id })) === 1,
    stock: (await m.Product.findById(product._id)).quantity,
    movements: (await m.StockMovement.find({ product: product._id }).sort({ _id: 1 }).lean())
      .map(x => [x.type, x.quantity, x.before, x.after, x.reference]),
    customer: buyer && { creditBalance: buyer.creditBalance, totalPurchases: buyer.totalPurchases }
  };
};
// The users who have an audit entry with this action for the invoice, oldest first.
const auditUsers = async (invoice, action) =>
  (await m.AuditLog.find({ action, entityId: invoice._id }).sort({ _id: 1 }).lean()).map(entry => String(entry.user));

test('C7 staff can hard-delete a paid invoice today: stock returns, purchases reverse, the offline ID cannot be re-sent and the number is reissued (changes at S0-1 and S0-6)', async () => {
  const product = await fx.seedProduct({ price: 20, quantity: 10 });
  const customer = await fx.seedCustomer();
  const sale = fx.posSale({ lines: [{ product, quantity: 4 }], customer });
  const created = await fx.api(users.staff).post('/api/invoices', sale);
  assert.equal(created.status, 201);
  const invoice = created.body.data;
  const before = await saleState({ invoice, product, customer });
  assert.deepEqual(before, {
    invoiceExists: true,
    stock: 6,
    movements: [['sale', -4, 10, 6, invoice.invoiceNumber]],
    customer: { creditBalance: 0, totalPurchases: 80 }
  });

  const res = await fx.api(users.staff).delete(`/api/invoices/${invoice._id}`);
  const after = await saleState({ invoice, product, customer });

  // CHANGES at S0-1: the assertions from here to the re-send check become
  //   status 405 with code INVOICE_DELETE_DISABLED;
  //   assert.deepEqual(after, before): invoice kept, stock 6, only the sale movement (no return
  //   movement), customer balance and purchases unchanged;
  //   auditUsers(invoice, 'INVOICE_DELETE_REFUSED') is [staff id] and auditUsers(invoice, 'INVOICE_DELETE') is [].
  assert.deepEqual([res.status, res.body.message], [200, 'Invoice deleted and stock restored.']);
  assert.deepEqual(after, {
    invoiceExists: false,
    stock: 10,
    movements: [...before.movements, ['return', 4, 6, 10, invoice.invoiceNumber]],
    customer: { creditBalance: 0, totalPurchases: 0 }
  });
  assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE'), [String(users.staff._id)]);
  assert.deepEqual((await m.AuditLog.findOne({ action: 'INVOICE_DELETE', entityId: invoice._id }).lean()).details,
    { invoiceNumber: invoice.invoiceNumber });
  assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE_REFUSED'), []);

  // The consumed offline decision outlives the invoice, so the same sale cannot be re-sent.
  // CHANGES at S0-1: the invoice is kept, so re-sending returns 200 duplicate with the original invoice.
  const resend = await fx.api(users.staff).post('/api/invoices', sale);
  assert.deepEqual([resend.status, resend.body.message],
    [409, 'The offline price decision was already consumed without a matching invoice.']);

  // Count-based numbering hands the deleted (latest) number to the next sale.
  // CHANGES at S0-1 and S0-6: the invoice is kept and numbers are never reused.
  const next = await fx.api(users.staff).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 1 }] }));
  assert.equal(next.status, 201);
  assert.equal(next.body.data.invoiceNumber, invoice.invoiceNumber);
});

test('C8 an invoice with a customer balance due is refused with 409 for admin, manager and staff, and everything is preserved (changes at S0-1)', async () => {
  const product = await fx.seedProduct({ price: 30, quantity: 10 });
  const customer = await fx.seedCustomer();
  const created = await fx.api(users.staff).post('/api/invoices',
    fx.posSale({ lines: [{ product, quantity: 2 }], paymentMethod: 'Credit', customer }));
  assert.equal(created.status, 201);
  const invoice = created.body.data;
  assert.deepEqual(await saleState({ invoice, product, customer }), {
    invoiceExists: true,
    stock: 8,
    movements: [['sale', -2, 10, 8, invoice.invoiceNumber]],
    customer: { creditBalance: 60, totalPurchases: 60 }
  });

  for (const role of ['admin', 'manager', 'staff']) {
    const before = await saleState({ invoice, product, customer });
    const res = await fx.api(users[role]).delete(`/api/invoices/${invoice._id}`);
    // CHANGES at S0-1: 405 with code INVOICE_DELETE_DISABLED for every role, whatever the balance.
    assert.equal(res.status, 409, role);
    assert.equal(res.body.message,
      'Invoices with an outstanding balance cannot be deleted because customer repayments are not allocated per invoice.', role);
    // Stays after S0-1: invoice, stock, the sale movement (no return movement) and the customer's
    // balance and purchases are exactly as they were immediately before the attempt.
    assert.deepEqual(await saleState({ invoice, product, customer }), before, role);
  }
  assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE'), []);
  // CHANGES at S0-1: one refusal entry per attempt, oldest first: [admin id, manager id, staff id].
  assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE_REFUSED'), []);
});

test('C21 admin, manager and staff can each hard-delete a paid invoice today; after S0-1 each gets 405 and everything is preserved', async () => {
  for (const role of ['admin', 'manager', 'staff']) {
    const product = await fx.seedProduct({ price: 10, quantity: 5 });
    const customer = await fx.seedCustomer();
    const created = await fx.api(users.staff).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 2 }], customer }));
    assert.equal(created.status, 201, role);
    const invoice = created.body.data;
    const before = await saleState({ invoice, product, customer });
    assert.deepEqual(before, {
      invoiceExists: true,
      stock: 3,
      movements: [['sale', -2, 5, 3, invoice.invoiceNumber]],
      customer: { creditBalance: 0, totalPurchases: 20 }
    }, role);

    const res = await fx.api(users[role]).delete(`/api/invoices/${invoice._id}`);
    const after = await saleState({ invoice, product, customer });

    // CHANGES at S0-1: the assertions from here to the end of the loop become
    //   status 405 with code INVOICE_DELETE_DISABLED;
    //   assert.deepEqual(after, before): invoice kept, stock 3, only the sale movement (no return
    //   movement), customer balance and purchases unchanged;
    //   auditUsers(invoice, 'INVOICE_DELETE_REFUSED') is [this role's user id] and
    //   auditUsers(invoice, 'INVOICE_DELETE') is [].
    assert.equal(res.status, 200, role);
    assert.deepEqual(after, {
      invoiceExists: false,
      stock: 5,
      movements: [...before.movements, ['return', 2, 3, 5, invoice.invoiceNumber]],
      customer: { creditBalance: 0, totalPurchases: 0 }
    }, role);
    assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE'), [String(users[role]._id)], role);
    assert.deepEqual(await auditUsers(invoice, 'INVOICE_DELETE_REFUSED'), [], role);
  }
});

test('C10 a manager\'s product edit writes the submitted quantity as absolute stock, so an old form value restores sold units (changes at S0-7)', async () => {
  const product = await fx.seedProduct({ price: 12.5, quantity: 10 });
  assert.equal((await fx.api(users.staff).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 3 }] }))).status, 201);
  assert.equal((await m.Product.findById(product._id)).quantity, 7);

  // The edit form loaded quantity 10 before the sale and always sends it back
  // (ProductsPage.jsx, productManagement.mjs).
  const res = await fx.api(users.manager).put(`/api/products/${product._id}`, { price: 15, quantity: 10 });

  // CHANGES at S0-7: a changed quantity is refused with 409 STOCK_EDIT_NOT_ALLOWED; stock moves
  // only through the audited stock-adjustment endpoint (reason code, version check, STOCK_ADJUST).
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.data.price, res.body.data.quantity], [15, 10]);
  const adjustments = await m.StockMovement.find({ product: product._id, type: 'adjustment' }).lean();
  assert.deepEqual(adjustments.map(x => [x.quantity, x.before, x.after, x.note, String(x.performedBy)]),
    [[3, 7, 10, 'Manual adjustment', String(users.manager._id)]]);
  const audit = await m.AuditLog.findOne({ action: 'PRODUCT_UPDATE', entityId: String(product._id) }).lean();
  assert.deepEqual([audit.details.before.quantity, audit.details.after.quantity], [7, 10]);
  assert.equal(await m.AuditLog.countDocuments({ action: 'STOCK_ADJUST' }), 0);

  // Stays: an edit without a quantity field leaves stock alone.
  const priceOnly = await fx.api(users.manager).put(`/api/products/${product._id}`, { price: 16 });
  assert.deepEqual([priceOnly.status, priceOnly.body.data.quantity], [200, 10]);
  assert.equal(await m.StockMovement.countDocuments({ product: product._id, type: 'adjustment' }), 1);
});

test('C23 manager-created products with a missing, zero or manager-entered cost can all be sold today; a manager\'s cost counts as known at once, a zero never does, and a manager can overwrite an admin-recorded cost (changes at S0-4, T-5)', async () => {
  // Expected after S0-4 (T-5); the assertions marked CHANGES below are replaced in that commit:
  //  * all three products are created with cost status "pending verification" and no stored cost;
  //  * every sale attempt is rejected until an admin records a genuine cost, and a rejected sale has
  //    no partial effect: no invoice, no stock change and no stock movement;
  //  * a manager's value, at creation or in a later edit, never verifies a cost, and a manager cannot
  //    change a cost that an admin has recorded;
  //  * a zero is never a verified cost, whoever enters it;
  //  * no cost is ever generated automatically;
  //  * once an admin records a genuine positive cost, the product can be sold and its sales carry it.
  const manager = fx.api(users.manager);
  const admin = fx.api(users.admin);
  const line = res => [res.status, res.body.data?.items?.[0]?.costKnown, res.body.data?.items?.[0]?.unitCost];
  // One sale attempt, with the invoice count, the product's stock quantity and its stock-movement
  // count captured immediately before and immediately after.
  const attemptSale = async product => {
    const read = async () => ({
      invoices: await m.Invoice.countDocuments(),
      stock: (await m.Product.findById(product._id)).quantity,
      movements: await m.StockMovement.countDocuments({ product: product._id })
    });
    const before = await read();
    const res = await fx.api(users.staff).post('/api/invoices', fx.posSale({ lines: [{ product, quantity: 1 }] }));
    return { res, before, after: await read() };
  };
  // Today's effect of every accepted sale: one invoice, stock down by one, one stock movement.
  const oneSale = ({ invoices, stock, movements }) => ({ invoices: invoices + 1, stock: stock - 1, movements: movements + 1 });

  const created = [
    await manager.post('/api/products', { name: 'Stage 0 product without cost', price: 20, category: 'Other', quantity: 5 }),
    await manager.post('/api/products', { name: 'Stage 0 product with zero cost', price: 20, category: 'Other', quantity: 5, costPrice: 0 }),
    await manager.post('/api/products', { name: 'Stage 0 product with manager-entered cost', price: 20, category: 'Other', quantity: 5, costPrice: 9 })
  ];
  // CHANGES at S0-4 (T-5): no cost is stored, and each product carries a pending-verification status.
  assert.deepEqual(created.map(res => [res.status, res.body.data.costPrice]),
    [[201, 0], [201, 0], [201, 9]]); // a missing cost is stored as zero; the manager's 9 is stored as given
  for (const res of created) {
    assert.deepEqual(Object.keys(res.body.data).filter(key => /cost/i.test(key)), ['costPrice']); // no cost-status field
  }
  const [missing, zero, entered] = created.map(res => res.body.data);

  // First sale attempt for each product. Today every sale is accepted, with the normal effects.
  // CHANGES at S0-4 (T-5): each attempt is rejected with no partial effect, so assert.deepEqual(after, before):
  // no invoice is created, the stock quantity does not change and no stock movement is created.
  // Today a missing or zero cost puts no cost on the invoice line (so no cost is generated), while the
  // manager's own 9 counts as a known cost at once, with no approval step.
  for (const [product, expectedLine] of [
    [missing, [201, false, undefined]],
    [zero, [201, false, undefined]],
    [entered, [201, true, 9]]
  ]) {
    const { res, before, after } = await attemptSale(product);
    assert.deepEqual(line(res), expectedLine, product.name);
    assert.deepEqual(after, oneSale(before), product.name);
  }
  const summary = (await admin.get('/api/reports/summary')).body.data;
  assert.deepEqual([summary.grossProfitAvailable, summary.uncostedInvoiceCount, summary.grossProfit], [false, 2, null]);

  // Today a manager can also change the cost later, and the new value counts as known at once.
  // CHANGES at S0-4 (T-5): the edit is rejected, the product stays pending, and the sale is rejected
  // with no partial effect (assert.deepEqual(after, before)).
  assert.equal((await manager.put(`/api/products/${entered._id}`, { costPrice: 12 })).status, 200);
  const editedSale = await attemptSale(entered);
  assert.deepEqual(line(editedSale.res), [201, true, 12]);
  assert.deepEqual(editedSale.after, oneSale(editedSale.before));

  // Stays: a zero is never a known cost, even when an admin enters it.
  // CHANGES at S0-4 (T-5): the zero does not verify the cost; the product stays pending, and the sale is
  // rejected with no partial effect (assert.deepEqual(after, before)).
  assert.equal((await admin.put(`/api/products/${zero._id}`, { costPrice: 0 })).status, 200);
  const zeroSale = await attemptSale(zero);
  assert.deepEqual(line(zeroSale.res), [201, false, undefined]);
  assert.deepEqual(zeroSale.after, oneSale(zeroSale.before));

  // Stays: an admin explicitly records a genuine cost of 11 on the uncosted product, and its next sale
  // carries 11 with the normal effects. CHANGES at S0-4 (T-5): this admin step is what makes it sellable.
  assert.equal((await admin.put(`/api/products/${missing._id}`, { costPrice: 11 })).status, 200);
  const verifiedSale = await attemptSale(missing);
  assert.deepEqual(line(verifiedSale.res), [201, true, 11]);
  assert.deepEqual(verifiedSale.after, oneSale(verifiedSale.before));

  // A manager then tries to change the admin-recorded cost. Today the change is accepted, the stored
  // cost becomes the manager's 5, and the next sale uses 5.
  // CHANGES at S0-4 (T-5): the manager's change is rejected, the stored cost stays 11, and the next sale
  // uses 11.
  const overwrite = await manager.put(`/api/products/${missing._id}`, { costPrice: 5 });
  assert.deepEqual([overwrite.status, overwrite.body.data.costPrice], [200, 5]);
  assert.equal((await m.Product.findById(missing._id)).costPrice, 5);
  const afterOverwrite = await attemptSale(missing);
  assert.deepEqual(line(afterOverwrite.res), [201, true, 5]);
  assert.deepEqual(afterOverwrite.after, oneSale(afterOverwrite.before));

  // Stays: nothing else is generated. The zero-cost product still has costPrice 0, and earlier sales
  // are never backfilled, so gross profit stays unavailable for this period.
  assert.equal((await m.Product.findById(zero._id)).costPrice, 0);
  const afterCost = (await admin.get('/api/reports/summary')).body.data;
  assert.deepEqual([afterCost.grossProfitAvailable, afterCost.uncostedInvoiceCount], [false, 3]);
});

test('C11 admin, manager and staff can each PUT protected customer fields: balances are overwritten and the customer can be soft-deleted (changes at S0-2)', async () => {
  for (const role of ['admin', 'manager', 'staff']) {
    const client = fx.api(users[role]);
    const customer = await fx.seedCustomer({ creditBalance: 250, totalPurchases: 400 });
    const path = `/api/customers/${customer._id}`;

    // Stays: approved contact fields can be updated.
    assert.equal((await client.put(path, { notes: 'Stage 0 synthetic note' })).status, 200, role);

    const balances = await client.put(path, { creditBalance: 0, totalPurchases: 0 });
    // CHANGES at S0-2: 400 CUSTOMER_PROTECTED_FIELDS with a CUSTOMER_UPDATE_REJECTED audit entry;
    // balances unchanged.
    assert.equal(balances.status, 200, role);
    assert.deepEqual([balances.body.data.creditBalance, balances.body.data.totalPurchases], [0, 0], role);

    const hidden = await client.put(path, { isDeleted: true });
    // CHANGES at S0-2: refused; removing a customer stays an admin/manager DELETE.
    assert.equal(hidden.status, 200, role);
    assert.equal((await client.get(path)).status, 404, role);

    // CHANGES at S0-2: accepted updates record before/after values in the same transaction.
    const audit = await m.AuditLog.find({ action: 'CUSTOMER_UPDATE', entityId: String(customer._id) }).lean();
    assert.deepEqual(audit.map(a => a.details), [undefined, undefined, undefined], role);
  }
});

test('C12 staff POST /customers/:id/pay subtracts with no ledger or audit; overpayment and "Infinity" clear the balance (changes at S0-3)', async () => {
  const cases = [
    { amount: 30, balance: 70, message: '$30.00 payment recorded for ' },
    { amount: 150, balance: 0, message: '$150.00 payment recorded for ' },
    { amount: 'Infinity', balance: 0, message: '$Infinity payment recorded for ' }
  ];

  for (const { amount, balance, message } of cases) {
    const customer = await fx.seedCustomer({ creditBalance: 100 });
    const res = await fx.api(users.staff).post(`/api/customers/${customer._id}/pay`, { amount });
    // CHANGES at S0-3: replaced by POST /api/customers/:id/payments (atomic ledger, unique request
    // ID, audit); overpayment is refused with 409 and non-finite amounts with 400.
    assert.equal(res.status, 200);
    assert.equal(res.body.data.creditBalance, balance);
    assert.ok(res.body.message.startsWith(message), res.body.message);
    assert.equal((await m.Customer.findById(customer._id)).creditBalance, balance);
    assert.equal(await m.AuditLog.countDocuments({ entityId: String(customer._id) }), 0);
  }
  assert.equal(await fx.collectionExists('customerpayments'), false);

  // Stays: zero and non-numeric amounts are refused with 400.
  const customer = await fx.seedCustomer({ creditBalance: 100 });
  for (const amount of [0, 'abc']) {
    assert.equal((await fx.api(users.staff).post(`/api/customers/${customer._id}/pay`, { amount })).status, 400);
  }
});

test('C17 a manager can PUT supplier debtBalance and isDeleted directly (changes at S0-2, T-2)', async () => {
  const supplier = await fx.seedSupplier({ debtBalance: 500 });
  const path = `/api/suppliers/${supplier._id}`;

  const res = await fx.api(users.manager).put(path, { debtBalance: 0 });
  // CHANGES at S0-2 (T-2): refused with 400; supplier balances change only through purchase
  // receiving and supplier payments.
  assert.equal(res.status, 200);
  assert.equal(res.body.data.debtBalance, 0);
  assert.equal((await m.Supplier.findById(supplier._id)).debtBalance, 0);

  const hidden = await fx.api(users.manager).put(path, { isDeleted: true });
  // CHANGES at S0-2 (T-2): refused; removing a supplier stays an admin DELETE.
  assert.equal(hidden.status, 200);
  assert.equal((await fx.api(users.manager).get(path)).status, 404);
  const audit = await m.AuditLog.find({ action: 'SUPPLIER_UPDATE', entityId: String(supplier._id) }).lean();
  assert.deepEqual(audit.map(a => a.details), [undefined, undefined]);

  // Stays: DELETE /api/suppliers/:id is admin-only.
  assert.equal((await fx.api(users.manager).delete(path)).status, 403);
});

test('C24 a manager can receive a purchase order and pay the supplier (payment changes at S0-4)', async () => {
  const admin = fx.api(users.admin);
  const manager = fx.api(users.manager);
  const supplier = await fx.seedSupplier();
  const product = await fx.seedProduct({ price: 25, costPrice: 10, quantity: 0 });
  const order = await admin.post('/api/purchase-orders',
    { supplierId: String(supplier._id), items: [{ productId: String(product._id), quantity: 3, unitCost: 10 }] });
  assert.equal(order.status, 201);
  const orderPath = `/api/purchase-orders/${order.body.data._id}`;
  assert.equal((await admin.patch(`${orderPath}/order`)).status, 200);
  // Stays: managers receive purchase orders (without seeing costs after S0-4).
  assert.equal((await manager.patch(`${orderPath}/receive`)).status, 200);
  assert.equal((await m.Supplier.findById(supplier._id)).debtBalance, 30);

  const paid = await manager.patch(`${orderPath}/pay`,
    { amount: 30, paymentMethod: 'Bank Transfer', reference: 'STAGE0-TRANSFER-1' });

  // CHANGES at S0-4: supplier payments become admin-only; a manager gets 403 and nothing changes.
  assert.equal(paid.status, 200);
  assert.deepEqual([paid.body.data.status, paid.body.data.amountPaid, paid.body.data.balanceDue], ['paid', 30, 0]);
  assert.deepEqual(paid.body.data.payments.map(p => [p.amount, p.paymentMethod, String(p.recordedBy)]),
    [[30, 'Bank Transfer', String(users.manager._id)]]);
  assert.equal((await m.Supplier.findById(supplier._id)).debtBalance, 0);
  // SUPPLIER_PAYMENT is not in the audit schema (C14), so no audit record exists. CHANGES at S0-5.
  assert.equal(await m.AuditLog.countDocuments({ action: 'SUPPLIER_PAYMENT' }), 0);
});
