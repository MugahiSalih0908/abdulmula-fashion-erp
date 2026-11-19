// src/offline/db.js
// IndexedDB schema via Dexie – stores offline data without deleting pending records.

import Dexie from 'dexie';

const db = new Dexie('AbdumulaFashionERP');

db.version(1).stores({
  pendingSales: '++id, offlineId, createdAt, isSynced',
  products:     '_id, name, category, barcode, sku, updatedAt',
  customers:    '_id, name, phone, updatedAt',
  syncMeta:     'key'
});

db.version(2).stores({
  pendingSales: '++id, offlineId, userId, createdAt, isSynced, syncStatus',
  products:     '_id, name, category, barcode, sku, updatedAt',
  customers:    '_id, name, phone, updatedAt',
  syncMeta:     'key'
}).upgrade(async transaction => {
  // Preserve all existing queued transactions. Do not guess who created them.
  // Legacy records without an owner are quarantined from automatic sync.
  await transaction.table('pendingSales').toCollection().modify(sale => {
    if (!sale.userId) {
      sale.syncStatus = 'owner_unknown';
      sale.syncError = 'This sale was saved before account ownership was recorded. Verify the original cashier before any manual recovery.';
    }
  });
});

// Customer contacts are shared business records fetched only while online.
// Remove the unused legacy offline customer cache (which could retain PII on a
// shared till phone). Pending sales and the POS catalogue remain untouched.
db.version(3).stores({
  pendingSales: '++id, offlineId, userId, createdAt, isSynced, syncStatus',
  products:     '_id, name, category, barcode, sku, updatedAt',
  customers:    null,
  syncMeta:     'key'
});

export default db;
