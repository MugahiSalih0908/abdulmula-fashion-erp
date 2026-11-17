import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCatalogProduct } from './posCatalog.mjs';
import useCartStore from '../store/cartStore.js';

const resetCart = () => useCartStore.getState().clearCart();
const addToCart = product => useCartStore.getState().addItem(product);

test('barcode lookup rejects zero, negative, non-finite, and fractional stock', () => {
  for (const quantity of [0, -1, NaN, Infinity, 1.5, '2']) {
    let addCalls = 0;
    const result = scanCatalogProduct(
      [{ sku: 'SKU-1', quantity }],
      'SKU-1',
      () => { addCalls += 1; return { ok: true, status: 'added' }; }
    );
    assert.equal(result.ok, false);
    assert.equal(addCalls, 1);
    assert.equal(result.status, quantity === 0 ? 'out-of-stock' : 'invalid-stock');
  }
});

test('barcode lookup delegates products with whole sellable stock to the cart', () => {
  const product = { barcode: '0123', quantity: 2 };
  let addedProduct;
  const result = scanCatalogProduct(
    [product],
    '0123',
    candidate => {
      addedProduct = candidate;
      return { ok: true, status: 'added' };
    }
  );
  assert.equal(addedProduct, product);
  assert.deepEqual(result, { ok: true, status: 'added', product });
});

test('scanning zero-stock product removes its cart line and preserves other items', () => {
  resetCart();
  const scanned = { _id: 'scanned', sku: 'ZERO', name: 'Zero stock', price: 10, quantity: 2 };
  const other = { _id: 'other', name: 'Other item', price: 5, quantity: 3 };
  addToCart(scanned);
  addToCart(other);

  const result = scanCatalogProduct(
    [{ ...scanned, quantity: 0 }],
    'ZERO',
    addToCart
  );
  const items = useCartStore.getState().items;

  assert.equal(result.ok, false);
  assert.equal(result.status, 'out-of-stock');
  assert.equal(result.cartReconciled, 'removed');
  assert.deepEqual(items.map(item => item.product._id), ['other']);
});

test('scanning reduced stock reconciles quantity without adding another unit', () => {
  resetCart();
  const scanned = { _id: 'scanned', sku: 'REDUCED', name: 'Reduced stock', price: 10, quantity: 5 };
  addToCart(scanned);
  useCartStore.getState().setQty('scanned', 4);

  const result = scanCatalogProduct(
    [{ ...scanned, quantity: 2 }],
    'REDUCED',
    addToCart
  );

  assert.equal(result.status, 'stock-adjusted');
  assert.equal(useCartStore.getState().items[0].quantity, 2);
});

test('scanning invalid stock removes its cart line and leaves other lines unchanged', () => {
  for (const quantity of [-1, 1.5, NaN, Infinity]) {
    resetCart();
    const scanned = { _id: 'scanned', sku: 'INVALID', name: 'Invalid stock', price: 10, quantity: 4 };
    const other = { _id: 'other', name: 'Other item', price: 5, quantity: 2 };
    addToCart(scanned);
    addToCart(other);

    const result = scanCatalogProduct(
      [{ ...scanned, quantity }],
      'INVALID',
      addToCart
    );

    assert.equal(result.status, 'invalid-stock');
    assert.equal(result.cartReconciled, 'removed');
    assert.deepEqual(
      useCartStore.getState().items.map(item => [item.product._id, item.quantity]),
      [['other', 1]]
    );
  }
});

test('valid whole-stock scan adds one unit without exceeding inventory', () => {
  resetCart();
  const product = { _id: 'valid', sku: 'VALID', name: 'Valid', price: 10, quantity: 2 };

  assert.equal(scanCatalogProduct([product], 'VALID', addToCart).status, 'added');
  assert.equal(scanCatalogProduct([product], 'VALID', addToCart).status, 'added');
  assert.equal(scanCatalogProduct([product], 'VALID', addToCart).status, 'stock-limit');
  assert.equal(useCartStore.getState().items[0].quantity, 2);
});
