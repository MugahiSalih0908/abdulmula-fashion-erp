// src/offline/db.js
// IndexedDB schema via Dexie – stores offline data

import Dexie from 'dexie';

const db = new Dexie('AbdumulaFashionERP');

db.version(1).stores({
  // Offline sale queue – synced to server when back online
  pendingSales: '++id, offlineId, createdAt, isSynced',

  // Cached product catalogue for offline POS
  products:     '_id, name, category, barcode, sku, updatedAt',

  // Cached customers
  customers:    '_id, name, phone, updatedAt',

  // Sync metadata
  syncMeta:     'key'
});

export default db;
