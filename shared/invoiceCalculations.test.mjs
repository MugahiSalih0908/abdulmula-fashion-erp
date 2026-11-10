import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertExpectedUnitPrice,
  addCurrency,
  buildInvoiceLine,
  calculateCashChange,
  calculateInvoiceTotals,
  calculatePayment,
  customerPurchaseDeltas,
  shouldReverseCustomerPurchases,
  subtractCurrency
} from './invoiceCalculations.mjs';

const product = {
  _id: 'product-1',
  name: 'Test product',
  price: 100,
  quantity: 5,
  isDeleted: false
};

test('calculates tax after discounts using the shared invoice formula', () => {
  const totals = calculateInvoiceTotals([
    { unitPrice: 100, quantity: 2, discount: 20 }
  ], 10);

  assert.deepEqual(totals, {
    subtotal: 200,
    discountTotal: 20,
    taxAmount: 18,
    taxRate: 10,
    grandTotal: 198
  });
});

test('rounds line and tax amounts to cents before returning persisted totals', () => {
  assert.equal(buildInvoiceLine(
    { quantity: 1, unitPrice: 1234567.005 },
    { ...product, price: 1234567.005 },
    'staff'
  ).unitPrice, 1234567.01);

  const line = buildInvoiceLine(
    { quantity: 3, unitPrice: 1.005, discount: 0.01 },
    { ...product, price: 1.005 },
    'staff'
  );
  assert.deepEqual(line, {
    quantity: 3,
    unitPrice: 1.01,
    discount: 0.01,
    lineTotal: 3.02,
    hasOverride: false
  });

  assert.deepEqual(calculateInvoiceTotals([line], 7.5), {
    subtotal: 3.03,
    discountTotal: 0.01,
    taxAmount: 0.23,
    taxRate: 7.5,
    grandTotal: 3.25
  });
  assert.equal(addCurrency(1234567.01, 0.02), 1234567.03);
  assert.equal(subtractCurrency(1234567.03, 0.02), 1234567.01);
});

test('rejects negative and oversized discounts without producing negative totals', () => {
  assert.throws(() => buildInvoiceLine(
    { quantity: 1, discount: -1 }, product, 'staff'
  ), /Discount cannot be negative/);
  assert.throws(() => buildInvoiceLine(
    { quantity: 1, discount: 101 }, product, 'staff'
  ), /Discount cannot exceed the line amount/);
  assert.throws(() => calculateInvoiceTotals([
    { unitPrice: 10, quantity: 1, discount: 11 }
  ]), /Discount cannot exceed the line amount/);
});

test('validates quantities, stock and submitted prices', () => {
  assert.throws(() => buildInvoiceLine(
    { quantity: 1 }, { ...product, isDeleted: true }, 'staff'
  ), /Product not found/);
  assert.throws(() => buildInvoiceLine(
    { quantity: 0 }, product, 'staff'
  ), /Quantity must be greater than zero/);
  assert.throws(() => buildInvoiceLine(
    { quantity: 4 }, product, 'staff', 2
  ), /Insufficient stock/);
  assert.throws(() => buildInvoiceLine(
    { quantity: 1, unitPrice: -1 }, product, 'staff'
  ), /Unit price cannot be negative/);
  assert.equal(buildInvoiceLine(
    { quantity: 2, discount: 20 }, product, 'staff'
  ).lineTotal, 180);
});

test('restricts and reports price overrides while using the catalog price by default', () => {
  const standard = buildInvoiceLine({ quantity: 1, unitPrice: 100 }, product, 'staff');
  assert.equal(standard.unitPrice, 100);
  assert.equal(standard.hasOverride, false);

  assert.throws(() => buildInvoiceLine(
    { quantity: 1, unitPrice: 90 }, product, 'staff'
  ), /Only admins and managers/);
  const override = buildInvoiceLine({ quantity: 1, unitPrice: 90 }, product, 'manager');
  assert.equal(override.unitPrice, 90);
  assert.equal(override.hasOverride, true);
});

test('allows queued offline sales only when their quoted price still matches catalog', () => {
  assert.doesNotThrow(() => assertExpectedUnitPrice(100, 100.004));
  assert.throws(() => assertExpectedUnitPrice(100, 101), {
    statusCode: 409,
    message: /price changed since this sale was saved offline/
  });
});

test('defaults Credit to unpaid and Cash/Mobile Transfer to paid', () => {
  assert.deepEqual(calculatePayment(120, 'Credit'), {
    paid: 0,
    balanceDue: 120,
    change: 0,
    paymentStatus: 'unpaid'
  });
  assert.deepEqual(calculatePayment(120, 'Cash'), {
    paid: 120,
    balanceDue: 0,
    change: 0,
    paymentStatus: 'paid'
  });
  assert.deepEqual(calculatePayment(120, 'Mobile Transfer'), {
    paid: 120,
    balanceDue: 0,
    change: 0,
    paymentStatus: 'paid'
  });
});

test('preserves explicit partial payments and derives accurate balances/status', () => {
  assert.deepEqual(calculatePayment(120, 'Credit', 30), {
    paid: 30,
    balanceDue: 90,
    change: 0,
    paymentStatus: 'partial'
  });
});

test('derives cash paid/change from actual tender and rejects stale insufficient tender', () => {
  assert.deepEqual(calculatePayment(90, 'Cash', undefined, 100), {
    paid: 90,
    balanceDue: 0,
    change: 10,
    paymentStatus: 'paid'
  });
  assert.throws(() => calculatePayment(110, 'Cash', undefined, 100), /Cash received is less/);
  assert.equal(calculateCashChange(0.3, 0.1), 0.2);
});

test('zero-value invoices do not create an unpaid balance', () => {
  assert.deepEqual(calculatePayment(0, 'Credit'), {
    paid: 0,
    balanceDue: 0,
    change: 0,
    paymentStatus: 'paid'
  });
});

test('rejects invalid payment methods and amounts', () => {
  assert.throws(() => calculatePayment(120, 'Cash', -1), /between zero and the invoice total/);
  assert.throws(() => calculatePayment(120, 'Mobile Transfer', 121), /between zero and the invoice total/);
  assert.throws(() => calculatePayment(120, 'Cheque'), /Payment method is invalid/);
});

test('updates customer purchases for every invoice and credit only for unpaid balance', () => {
  assert.deepEqual(customerPurchaseDeltas(120, 0), {
    totalPurchases: 120,
    creditBalance: 0
  });
  assert.deepEqual(customerPurchaseDeltas(120, 90), {
    totalPurchases: 120,
    creditBalance: 90
  });
});

test('only reverses legacy invoices that were previously included in customer metrics', () => {
  assert.equal(shouldReverseCustomerPurchases({
    customerPurchaseRecorded: true,
    balanceDue: 0
  }), true);
  assert.equal(shouldReverseCustomerPurchases({
    customerPurchaseRecorded: undefined,
    balanceDue: 10
  }), true);
  assert.equal(shouldReverseCustomerPurchases({
    customerPurchaseRecorded: undefined,
    balanceDue: 0
  }), false);
});
