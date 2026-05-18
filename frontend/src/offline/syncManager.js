// src/offline/syncManager.js
// Handles syncing queued offline sales when internet returns

import db  from './db';
import api from '../services/api';

/**
 * saveSaleOffline – called when network is unavailable
 * Stores the cart + metadata in IndexedDB
 */
export const saveSaleOffline = async (salePayload) => {
  const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.pendingSales.add({
    ...salePayload,
    offlineId,
    createdAt: new Date().toISOString(),
    isSynced:  false
  });
  return offlineId;
};

/**
 * syncPendingSales – push all unsynced sales to the server
 * Called automatically when online event fires
 */
export const syncPendingSales = async () => {
  const pending = await db.pendingSales.where({ isSynced: false }).toArray();
  if (!pending.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      await api.post('/invoices', { ...sale, offlineId: sale.offlineId });
      await db.pendingSales.update(sale.id, { isSynced: true });
      synced++;
    } catch (err) {
      // Keep it in queue unless it's a business logic error (not a network error)
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        // e.g. product deleted while offline – mark as failed so UI can show it
        await db.pendingSales.update(sale.id, { isSynced: false, syncError: err?.response?.data?.message });
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
  db.pendingSales.where({ isSynced: false }).count();

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
