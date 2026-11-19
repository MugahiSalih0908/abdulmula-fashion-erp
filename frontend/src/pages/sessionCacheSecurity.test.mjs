import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pwaConfig = readFileSync('vite.config.js', 'utf8');
const appSource = readFileSync('src/App.jsx', 'utf8');
const entrySource = readFileSync('src/main.jsx', 'utf8');

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
