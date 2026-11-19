export function normalizeOwnerUserId(value) {
  const userId = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(userId)) {
    throw new Error('Sign in with the staff account that created this sale before saving or synchronizing it.');
  }
  return userId;
}

export function isSaleOwnedByUser(sale, userId) {
  try {
    return Boolean(sale && sale.userId && normalizeOwnerUserId(sale.userId) === normalizeOwnerUserId(userId));
  } catch {
    return false;
  }
}

export function canSyncSaleForUser(sale, userId) {
  return isSaleOwnedByUser(sale, userId)
    && sale.isSynced === false
    && !['blocked', 'rejected', 'owner_unknown'].includes(sale.syncStatus);
}

export function pendingCheckoutStorageKey(userId) {
  return `pos.pendingCheckout.${normalizeOwnerUserId(userId)}`;
}

export function readPendingCheckout(storageKey) {
  if (!storageKey) return null;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value !== 'object' || typeof value.offlineId !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

export function writePendingCheckout(storageKey, checkout) {
  if (!storageKey || !checkout || typeof checkout.offlineId !== 'string') {
    throw new Error('Pending checkout cannot be saved without a valid staff account.');
  }
  localStorage.setItem(storageKey, JSON.stringify({
    offlineId: checkout.offlineId,
    createdAt: checkout.createdAt
  }));
}

export function clearPendingCheckout(storageKey, offlineId) {
  const current = readPendingCheckout(storageKey);
  if (!current || current.offlineId !== offlineId) return false;
  localStorage.removeItem(storageKey);
  return true;
}
