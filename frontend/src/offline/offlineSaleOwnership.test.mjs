import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOwnerUserId, isSaleOwnedByUser, canSyncSaleForUser, pendingCheckoutStorageKey } from './offlineSaleOwnership.mjs';

const A = '64c000000000000000000001';
const B = '64c000000000000000000002';

test('requires a valid signed-in owner ID', () => {
  assert.equal(normalizeOwnerUserId(A), A);
  assert.throws(() => normalizeOwnerUserId(''), /Sign in/);
  assert.throws(() => normalizeOwnerUserId('not-an-id'), /Sign in/);
});

test('a pending sale is visible only to its creating account', () => {
  const sale = { userId: A, isSynced: false, syncStatus: 'pending' };
  assert.equal(isSaleOwnedByUser(sale, A), true);
  assert.equal(isSaleOwnedByUser(sale, B), false);
  assert.equal(canSyncSaleForUser(sale, A), true);
  assert.equal(canSyncSaleForUser(sale, B), false);
});

test('legacy unowned and review-blocked sales never auto-sync', () => {
  assert.equal(canSyncSaleForUser({ isSynced: false, syncStatus: 'owner_unknown' }, A), false);
  assert.equal(canSyncSaleForUser({ userId: A, isSynced: false, syncStatus: 'blocked' }, A), false);
});

test('pending checkout storage keys are account-specific', () => {
  assert.notEqual(pendingCheckoutStorageKey(A), pendingCheckoutStorageKey(B));
});
