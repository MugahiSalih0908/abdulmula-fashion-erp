// src/offline/syncManager.js
// Handles syncing queued offline sales when internet returns

import db  from './db';
import api from '../services/api';

const normalizeOfflineId = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error('Offline ID cannot be empty or whitespace-only.'), {
      code: 'OFFLINE_ID_INVALID'
    });
  }
  const normalized = value.trim();
  if (normalized.length > 200) {
    throw Object.assign(new Error('Offline ID must be at most 200 characters.'), {
      code: 'OFFLINE_ID_INVALID'
    });
  }
  return normalized;
};

const offlineIdsMatch = (candidate, canonical) => {
  try {
    return normalizeOfflineId(candidate) === canonical;
  } catch {
    return false;
  }
};

/**
 * saveSaleOffline – called when network is unavailable
 * Stores the cart + metadata in IndexedDB
 */
export const saveSaleOffline = async (salePayload, requestedOfflineId = salePayload.offlineId) => {
  const offlineId = requestedOfflineId == null
    ? `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    : normalizeOfflineId(requestedOfflineId);
  const existing = await db.pendingSales
    .toCollection()
    .filter(sale => offlineIdsMatch(sale.offlineId, offlineId))
    .first();
  if (existing?.syncStatus === 'rejected') {
    throw new Error('This offline sale was rejected and cannot be resubmitted.');
  }
  const signature = (sale) => JSON.stringify({
    items: sale.items.map(({ productId, productName, quantity, unitPrice, expectedUnitPrice, discount }) => ({
      productId,
      productName,
      quantity,
      unitPrice: unitPrice ?? null,
      expectedUnitPrice: expectedUnitPrice ?? unitPrice ?? null,
      discount
    })),
    paymentMethod: sale.paymentMethod,
    amountPaid: sale.amountPaid,
    taxRate: sale.taxRate,
    customerId: sale.customerId,
    note: sale.note,
    cashReceived: sale.cashReceived,
    offlineCreatedAt: sale.offlineCreatedAt
  });
  if (existing && signature(existing) !== signature(salePayload)) {
    throw new Error('A different offline sale already uses this checkout ID.');
  }

  const record = {
    ...salePayload,
    items: salePayload.items.map(item => ({
      ...item,
      ...(item.expectedUnitPrice === undefined && item.unitPrice !== undefined
        ? { expectedUnitPrice: item.unitPrice }
        : {})
    })),
    offlineId,
    offlineCreatedAt: salePayload.offlineCreatedAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isSynced: false,
    syncStatus: 'pending'
  };
  if (!existing) {
    await db.pendingSales.add(record);
  }
  return offlineId;
};

export const markSaleSynced = async (offlineId) => {
  offlineId = normalizeOfflineId(offlineId);
  const records = await db.pendingSales
    .toCollection()
    .filter(sale => offlineIdsMatch(sale.offlineId, offlineId))
    .toArray();
  await Promise.all(records.map(record => db.pendingSales.update(record.id, {
    isSynced: true,
    syncStatus: 'synced',
    syncError: undefined
  })));
  const pendingCheckoutId = localStorage.getItem('pos.pendingCheckoutId');
  if (offlineIdsMatch(pendingCheckoutId, offlineId)) {
    localStorage.removeItem('pos.pendingCheckoutId');
    localStorage.removeItem('pos.pendingCheckoutCreatedAt');
  }
  return records.length;
};

export const getOfflineSales = () =>
  db.pendingSales
    .toCollection()
    .filter(sale => sale.isSynced === false)
    .toArray();

export const approveOfflinePriceConflict = async (saleId) => {
  const sale = await db.pendingSales.get(saleId);
  if (!sale || sale.isSynced || sale.syncStatus !== 'blocked' ||
      !sale.syncConflict?.items?.length) {
    throw new Error('This sale is not awaiting price-conflict approval.');
  }

  const {
    id,
    createdAt,
    isSynced,
    syncStatus,
    syncError,
    ...payload
  } = sale;
  const offlineId = normalizeOfflineId(sale.offlineId);
  const offlineOriginalPayload = {
    ...sale,
    offlineId,
    offlineCreatedAt: sale.offlineCreatedAt || sale.createdAt
  };
  const approvalItems = sale.items.map((item, index) => {
    const conflictItem = sale.syncConflict.items[index];
    if (!conflictItem || String(conflictItem.productId) !== String(item.productId)) {
      throw new Error('Price details are incomplete; sync the sale again to refresh the review.');
    }
    const offlineQuotedUnitPrice = item.unitPrice ?? item.expectedUnitPrice;
    const currentUnitPriceAtReview = conflictItem.currentUnitPriceAtConflict;
    if (!Number.isFinite(offlineQuotedUnitPrice) || !Number.isFinite(currentUnitPriceAtReview)) {
      throw new Error('Price details are incomplete; this sale cannot be approved safely.');
    }
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      offlineQuotedUnitPrice,
      currentUnitPriceAtReview
    };
  });

  try {
    const approvalResponse = await api.post('/invoices/offline-conflicts/approve', {
      offlineId,
      clientReportedOfflineAt: sale.offlineCreatedAt || sale.createdAt,
      sale: offlineOriginalPayload,
      items: approvalItems.map(item => ({
        ...item,
        currentUnitPriceAtConflict: item.currentUnitPriceAtReview
      }))
    });
    const approvedItems = approvalResponse.data.data.items;
    payload.items = sale.items.map((item, index) => ({
      ...item,
      unitPrice: approvedItems[index].offlineQuotedUnitPrice,
      expectedUnitPrice: approvedItems[index].reviewedUnitPrice
    }));
    payload.offlineId = offlineId;
    payload.offlineConflictApproval = true;
    payload.offlineOriginalPayload = offlineOriginalPayload;
    const { data } = await api.post('/invoices', payload);
    await markSaleSynced(offlineId);
    return data.data;
  } catch (error) {
    const status = error?.response?.status;
    if ((status && status >= 400 && status < 500) || error?.code === 'OFFLINE_ID_INVALID') {
      await db.pendingSales.update(saleId, {
        syncStatus: 'blocked',
        syncError: error?.response?.data?.message || 'Sale requires review before it can sync.',
        ...(error?.response?.data?.conflictDetails
          ? { syncConflict: error.response.data.conflictDetails }
          : {})
      });
    }
    throw error;
  }
};

export const rejectOfflinePriceConflict = async (saleId) => {
  const sale = await db.pendingSales.get(saleId);
  if (!sale || sale.isSynced || sale.syncStatus !== 'blocked' || !sale.syncConflict?.items?.length) {
    throw new Error('This sale is not awaiting price-conflict resolution.');
  }
  const offlineId = normalizeOfflineId(sale.offlineId);

  const items = sale.items.map((item, index) => {
    const conflictItem = sale.syncConflict.items[index];
    if (!conflictItem || String(conflictItem.productId) !== String(item.productId)) {
      throw new Error('Price details are incomplete; sync the sale again to refresh the review.');
    }
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      offlineQuotedUnitPrice: item.unitPrice ?? item.expectedUnitPrice,
      currentUnitPriceAtConflict: conflictItem.currentUnitPriceAtConflict ?? null
    };
  });
  if (items.some(item =>
    !Number.isFinite(item.offlineQuotedUnitPrice) ||
    !Number.isFinite(item.quantity)
  )) {
    throw new Error('Price details are incomplete; this sale cannot be rejected safely.');
  }

  const { data } = await api.post('/invoices/offline-conflicts/reject', {
    offlineId,
    clientReportedOfflineAt: sale.offlineCreatedAt || sale.createdAt,
    sale: { ...sale, offlineId, offlineCreatedAt: sale.offlineCreatedAt || sale.createdAt },
    reason: 'Rejected by an authenticated manager or admin.',
    items
  });
  const resolution = data.data;
  await db.pendingSales.update(saleId, {
    isSynced: false,
    syncStatus: 'rejected',
    syncError: undefined,
    resolution: {
      decision: 'reject',
      decidedAt: resolution.decisionAt,
      decidedBy: resolution.decidedBy
    }
  });
  const pendingCheckoutId = localStorage.getItem('pos.pendingCheckoutId');
  if (offlineIdsMatch(pendingCheckoutId, offlineId)) {
    localStorage.removeItem('pos.pendingCheckoutId');
  }
  return resolution;
};

/**
 * syncPendingSales – push all unsynced sales to the server
 * Called automatically when online event fires
 */
export const syncPendingSales = async () => {
  const pending = await db.pendingSales
    .toCollection()
    .filter(sale => sale.isSynced === false && !['blocked', 'rejected'].includes(sale.syncStatus))
    .toArray();
  if (!pending.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const offlineId = normalizeOfflineId(sale.offlineId);
      const saleWithoutPayment = { ...sale };
      const payload = {
        ...saleWithoutPayment,
        items: sale.items.map(item => ({
          ...item,
          expectedUnitPrice: item.expectedUnitPrice ?? item.unitPrice
        })),
        offlineId
      };
      await api.post('/invoices', payload);
      await markSaleSynced(offlineId);
      synced++;
    } catch (err) {
      // Keep it in queue unless it's a business logic error (not a network error)
      const status = err?.response?.status;
      if ((status && status >= 400 && status < 500) || err?.code === 'OFFLINE_ID_INVALID') {
        await db.pendingSales.update(sale.id, {
          isSynced: false,
          syncStatus: 'blocked',
          syncError: err?.response?.data?.message || 'Sale requires review before it can sync.',
          ...(err?.response?.data?.conflictDetails
            ? { syncConflict: err.response.data.conflictDetails }
            : {})
        });
        failed++;
      }
      // Network error → leave in queue, retry next time
    }
  }

  return { synced, failed };
};

/**
 * getPendingCount – reactive count of unsynced sales
 */
export const getPendingCount = () =>
  db.pendingSales
    .toCollection()
    .filter(sale => sale.isSynced === false && !['blocked', 'rejected'].includes(sale.syncStatus))
    .count();

/**
 * cacheProducts – store full product list in IndexedDB for offline POS
 */
export const cacheProducts = async (products) => {
  await db.products.clear();
  await db.products.bulkPut(products.map(p => ({ ...p, _id: p._id.toString() })));
  await db.syncMeta.put({ key: 'productsLastSync', value: new Date().toISOString() });
};

/**
 * getOfflineProducts – read products from IndexedDB
 */
export const getOfflineProducts = () => db.products.toArray();

/**
 * cacheCustomers
 */
export const cacheCustomers = async (customers) => {
  await db.customers.clear();
  await db.customers.bulkPut(customers.map(c => ({ ...c, _id: c._id.toString() })));
};

export const getOfflineCustomers = () => db.customers.toArray();
