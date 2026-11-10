import assert from 'node:assert/strict';
import test from 'node:test';
import useCartStore from './cartStore.js';

const resetCart = () => {
  useCartStore.getState().clearCart();
  useCartStore.getState().addItem({
    _id: 'product-1',
    name: 'Test product',
    price: 100,
    quantity: 5
  });
  useCartStore.getState().setTaxRate(10);
  useCartStore.getState().setDiscount('product-1', 20);
};

test('cart and checkout payload share post-discount tax totals', () => {
  resetCart();
  const cart = useCartStore.getState();
  assert.equal(cart.taxAmount(), 8);
  assert.equal(cart.grandTotal(), 88);
});

test('checkout payload uses the intended default paid amount per method', () => {
  resetCart();
  const cart = useCartStore.getState();

  cart.setPaymentMethod('Credit');
  assert.equal(cart.toInvoicePayload().amountPaid, 0);

  cart.setPaymentMethod('Cash');
  cart.setCashReceived(100);
  assert.equal(cart.toInvoicePayload().amountPaid, 88);

  cart.setPaymentMethod('Mobile Transfer');
  assert.equal(cart.toInvoicePayload().amountPaid, 88);
});

test('cart rejects negative and oversized line discounts', () => {
  resetCart();
  const cart = useCartStore.getState();

  assert.equal(cart.setDiscount('product-1', -1), false);
  assert.equal(cart.setDiscount('product-1', 101), false);
  assert.equal(useCartStore.getState().items[0].discount, 20);
});

test('cart rejects zero, negative, non-finite, non-numeric, and fractional stock', () => {
  for (const [index, quantity] of [0, -1, NaN, Infinity, '2', 'unknown', 0.75, null].entries()) {
    useCartStore.getState().clearCart();
    const result = useCartStore.getState().addItem({
      _id: `unavailable-${index}`,
      name: 'Unavailable',
      price: 10,
      quantity
    });
    assert.equal(result.ok, false);
    assert.equal(useCartStore.getState().items.length, 0);
  }

  assert.equal(useCartStore.getState().addItem({
    _id: 'valid-integer',
    name: 'Valid inventory',
    price: 10,
    quantity: 1
  }).ok, true);
});

test('initial cart quantity is capped at available whole units', () => {
  useCartStore.getState().clearCart();
  const result = useCartStore.getState().addItem({
    _id: 'limited',
    name: 'Limited',
    price: 10,
    quantity: 2
  }, 4);

  assert.deepEqual(result, { ok: true, status: 'stock-limit', quantity: 2 });
  assert.equal(useCartStore.getState().items[0].quantity, 2);
});

test('repeated additions stop at stock boundaries and reconcile stale cart stock', () => {
  useCartStore.getState().clearCart();
  const product = { _id: 'boundary', name: 'Boundary', price: 10, quantity: 2 };

  assert.equal(useCartStore.getState().addItem(product).status, 'added');
  assert.equal(useCartStore.getState().addItem(product).status, 'added');
  assert.deepEqual(useCartStore.getState().addItem(product), {
    ok: true,
    status: 'stock-limit',
    quantity: 2
  });
  assert.equal(useCartStore.getState().items[0].quantity, 2);

  useCartStore.getState().setQty('boundary', 4);
  const reducedStock = { ...product, quantity: 1 };
  assert.deepEqual(useCartStore.getState().addItem(reducedStock), {
    ok: true,
    status: 'stock-adjusted',
    quantity: 1
  });
  assert.equal(useCartStore.getState().items[0].quantity, 1);
});

test('fractional inventory is invalid and quantity edits stay within whole stock', () => {
  useCartStore.getState().clearCart();
  const product = { _id: 'fractional', name: 'Fractional stock', price: 10, quantity: 1.5 };

  assert.deepEqual(useCartStore.getState().addItem(product), {
    ok: false,
    status: 'invalid-stock',
    cartReconciled: 'unchanged'
  });
  assert.equal(useCartStore.getState().items.length, 0);
});
