const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PAYMENT_METHODS,
  calculatePurchaseOrderTotals,
  normalizeSupplierPayment
} = require('./purchaseOrderValidation');

test('purchase order totals use whole-unit quantities and round money to cents', () => {
  assert.deepEqual(calculatePurchaseOrderTotals([
    { productId: 'p1', quantity: 3, unitCost: '12.345' },
    { productId: 'p2', quantity: 2, unitCost: 4.5 }
  ], '1.12'), {
    items: [
      { productId: 'p1', quantity: 3, unitCost: 12.35 },
      { productId: 'p2', quantity: 2, unitCost: 4.5 }
    ],
    subtotal: 46.05,
    discount: 1.12,
    grandTotal: 44.93
  });
});

test('purchase order totals reject missing items, fractional quantities and invalid costs', () => {
  assert.throws(() => calculatePurchaseOrderTotals([]), /between 1 and 100 items/);
  assert.throws(() => calculatePurchaseOrderTotals([{ productId: 'p1', quantity: 1.5, unitCost: 2 }]), /whole number/);
  assert.throws(() => calculatePurchaseOrderTotals([{ productId: 'p1', quantity: 1, unitCost: -1 }]), /zero or greater/);
  assert.throws(() => calculatePurchaseOrderTotals([{ productId: 'p1', quantity: 1, unitCost: 2 }], 3), /cannot exceed/);
});

test('supplier payment validates method, eligibility and available balance', () => {
  assert.deepEqual(PAYMENT_METHODS, ['Cash', 'Bank Transfer', 'Mobile Transfer', 'Other']);
  const payment = normalizeSupplierPayment({
    amount: '25.50',
    paymentMethod: 'Cash',
    date: '2026-11-16',
    reference: '  Drawer 02 ',
    note: '  Deposit '
  }, { balanceDue: 100, status: 'received' });

  assert.equal(payment.amount, 25.5);
  assert.equal(payment.paymentMethod, 'Cash');
  assert.equal(payment.date.toISOString().slice(0, 10), '2026-11-16');
  assert.equal(payment.reference, 'Drawer 02');
  assert.equal(payment.note, 'Deposit');
});

test('supplier payment rejects overpayment, draft orders and unsupported methods', () => {
  assert.throws(
    () => normalizeSupplierPayment({ amount: 101 }, { balanceDue: 100, status: 'received' }),
    /exceed the outstanding balance/
  );
  assert.throws(
    () => normalizeSupplierPayment({ amount: 10 }, { balanceDue: 100, status: 'draft' }),
    /after goods are received/
  );
  assert.throws(
    () => normalizeSupplierPayment({ amount: 10, paymentMethod: 'Crypto' }, { balanceDue: 100, status: 'received' }),
    /supported supplier payment method/
  );
});

test('supplier payment trims optional fields and rejects invalid amounts or dates', () => {
  const clean = normalizeSupplierPayment(
    { amount: 1, reference: '', note: '', date: '2026-11-16' },
    { balanceDue: 1, status: 'received' }
  );
  assert.equal('reference' in clean, false);
  assert.equal('note' in clean, false);
  assert.throws(() => normalizeSupplierPayment({ amount: 0 }, { balanceDue: 1, status: 'received' }), /greater than zero/);
  assert.throws(() => normalizeSupplierPayment({ amount: 1, date: 'bad-date' }, { balanceDue: 1, status: 'received' }), /valid payment date/);
});
