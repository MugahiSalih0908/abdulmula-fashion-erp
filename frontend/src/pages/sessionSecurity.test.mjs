import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
