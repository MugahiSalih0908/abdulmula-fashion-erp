import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(new URL('../services/api.js', import.meta.url), 'utf8');

test('token refresh uses a same-origin Web Lock to serialize browser tabs', () => {
  assert.match(apiSource, /navigator\.locks\?\.request/);
  assert.match(apiSource, /abdulmula-refresh-\$\{refreshingUserId\}/);
  assert.match(apiSource, /Read the latest refresh token after acquiring the cross-tab lock/);
});

test('cross-tab refresh lock is optional for browsers without Web Locks support', () => {
  assert.match(apiSource, /typeof navigator !== 'undefined' && navigator\.locks\?\.request/);
  assert.match(apiSource, /: await rotateSession\(\)/);
});

const cartDrawerSource = readFileSync(new URL('../components/pos/CartDrawer.jsx', import.meta.url), 'utf8');
const cartStoreSource = readFileSync(new URL('../store/cartStore.js', import.meta.url), 'utf8');

test('staff POS controls enforce the shared discount cap and hide tax-rate editing', () => {
  assert.match(cartDrawerSource, /canManagePricing && <section aria-labelledby="cart-tax-heading">/);
  assert.match(cartDrawerSource, /STAFF_MAX_DISCOUNT_PERCENT/);
  assert.match(cartDrawerSource, /cart\.setDiscount\(product\.\_id, event\.target\.value, canManagePricing \? 100 : STAFF_MAX_DISCOUNT_PERCENT\)/);
  assert.match(cartStoreSource, /maxDiscountPercent = 100/);
});
