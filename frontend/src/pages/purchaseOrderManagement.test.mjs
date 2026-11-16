import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderPreview,
  filterPurchaseOrders,
  isValidPurchaseOrderPayload,
  isValidSupplierPaymentPayload,
  normalizePurchaseOrderPayload,
  normalizeSupplierPaymentPayload,
  summarizePurchaseOrders
} from './purchaseOrderManagement.mjs';

const orders = [
  { _id: '1', poNumber: 'PO-001', supplierName: 'Al Nour Textiles', status: 'draft', grandTotal: 400, balanceDue: 400 },
  { _id: '2', poNumber: 'PO-002', supplierName: 'Juba Garments', status: 'ordered', grandTotal: 200, balanceDue: 200 },
  { _id: '3', poNumber: 'PO-003', supplierName: 'Al Nour Textiles', status: 'partial', grandTotal: 300, balanceDue: 100 }
];

test('purchase order search matches order number, supplier, status and line item', () => {
  assert.deepEqual(filterPurchaseOrders(orders, 'po-002').map(item => item._id), ['2']);
  assert.deepEqual(filterPurchaseOrders(orders, 'AL NOUR').map(item => item._id), ['1', '3']);
  assert.deepEqual(filterPurchaseOrders([{ ...orders[0], items: [{ productName: 'Silk Toub' }] }], 'silk').map(item => item._id), ['1']);
});

test('purchase order summary totals loaded records and status buckets', () => {
  assert.deepEqual(summarizePurchaseOrders(orders), {
    count: 3,
    value: 900,
    balanceDue: 700,
    drafts: 1,
    awaitingReceipt: 1,
    received: 0,
    partiallyPaid: 1,
    paid: 0
  });
});

test('order preview calculates subtotal, discount and grand total safely', () => {
  assert.deepEqual(calculateOrderPreview([
    { quantity: 3, unitCost: 10.25 },
    { quantity: 2, unitCost: 5 }
  ], 2.5), { subtotal: 40.75, discount: 2.5, grandTotal: 38.25 });
  assert.deepEqual(calculateOrderPreview([{ quantity: 1.5, unitCost: 10 }], 0), { subtotal: 0, discount: 0, grandTotal: 0 });
});

test('purchase order payload is normalized and validated', () => {
  const payload = normalizePurchaseOrderPayload({
    supplierId: 'supplier-1',
    items: [{ productId: 'product-1', quantity: '2', unitCost: '12.5' }],
    discount: '1',
    note: ' Delivery next week '
  });
  assert.deepEqual(payload, {
    supplierId: 'supplier-1',
    items: [{ productId: 'product-1', quantity: 2, unitCost: 12.5 }],
    discount: 1,
    note: 'Delivery next week'
  });
  assert.equal(isValidPurchaseOrderPayload(payload), true);
  assert.equal(isValidPurchaseOrderPayload({ ...payload, items: [{ productId: 'x', quantity: 0, unitCost: 2 }] }), false);
});

test('supplier payment payload validates amount, balance, method and date', () => {
  const values = {
    amount: '50',
    paymentMethod: 'Bank Transfer',
    date: '2026-11-16',
    reference: '  TX-100  ',
    note: '  Deposit '
  };
  assert.deepEqual(normalizeSupplierPaymentPayload(values), {
    amount: 50,
    paymentMethod: 'Bank Transfer',
    date: '2026-11-16',
    reference: 'TX-100',
    note: 'Deposit'
  });
  assert.equal(isValidSupplierPaymentPayload(values, 100), true);
  assert.equal(isValidSupplierPaymentPayload(values, 25), false);
  assert.equal(isValidSupplierPaymentPayload({ ...values, paymentMethod: 'Crypto' }, 100), false);
  assert.equal(isValidSupplierPaymentPayload({ ...values, date: 'bad' }, 100), false);
});
