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
