export function normalizeOwnerUserId(value) {
  const userId = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(userId)) {
    throw new Error('Sign in with the staff account that created this sale before saving or synchronizing it.');
  }
  return userId;
}

export function isSaleOwnedByUser(sale, userId) {
  return Boolean(sale && userId && String(sale.userId || '').toLowerCase() === String(userId).toLowerCase());
}

export function canSyncSaleForUser(sale, userId) {
  return isSaleOwnedByUser(sale, userId)
    && sale.isSynced === false
    && !['blocked', 'rejected', 'owner_unknown'].includes(sale.syncStatus);
}

export function pendingCheckoutStorageKey(userId) {
  return `pos.pendingCheckout.${normalizeOwnerUserId(userId)}`;
}
