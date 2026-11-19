import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pwaConfig = readFileSync('vite.config.js', 'utf8');
const appSource = readFileSync('src/App.jsx', 'utf8');
const entrySource = readFileSync('src/main.jsx', 'utf8');
const syncSource = readFileSync('src/offline/syncManager.js', 'utf8');
const hookSource = readFileSync('src/hooks/useOnlineStatus.js', 'utf8');
const authSource = readFileSync('src/store/authStore.js', 'utf8');
const settingsSource = readFileSync('src/pages/SettingsPage.jsx', 'utf8');
const posSource = readFileSync('src/pages/POSPage.jsx', 'utf8');

test('service worker does not runtime-cache authenticated API responses', () => {
  assert.match(pwaConfig, /runtimeCaching:\s*\[\]/);
});

test('legacy API caches are deleted when the app starts', () => {
  for (const cacheName of ['products-cache', 'customers-cache', 'dashboard-cache']) {
    assert.ok(entrySource.includes(cacheName), 'missing cache purge for ' + cacheName);
  }
});

test('private query cache is cleared when the signed-in account changes', () => {
  assert.match(appSource, /previousUserId\.current !== userId/);
  assert.match(appSource, /queryClient\.clear\(\)/);
});

test('offline sales are tagged and synchronized only for their cashier', () => {
  assert.match(syncSource, /ownerUserId,/);
  assert.match(syncSource, /sale\.ownerUserId === ownerUserId/);
  assert.match(syncSource, /syncPendingSales = async \(ownerUserId\)/);
  assert.match(hookSource, /syncPendingSales\(ownerUserId\)/);
  assert.match(posSource, /saveSaleOffline\(payload, payload\.offlineId, ownerUserId\)/);
});

test('offline review is restricted to the owning user unless manager/admin review is enabled', () => {
  assert.match(syncSource, /assertSaleOwnership/);
  assert.match(settingsSource, /getOfflineSales\(offlineUserId, isManager\)/);
  assert.match(settingsSource, /approveOfflinePriceConflict\(saleId, offlineUserId, isManager\)/);
});

test('logout requests server-side refresh-token revocation', () => {
  assert.match(authSource, /api\.post\('\/auth\/logout', \{ refreshToken \}/);
});
