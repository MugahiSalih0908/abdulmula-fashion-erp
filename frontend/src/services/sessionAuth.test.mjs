import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionAuthConfig } from './sessionAuth.mjs';

function storage(values = {}) {
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; }
  };
}

test('captures the active session token for the expected staff owner', () => {
  const result = getSessionAuthConfig('64c000000000000000000001', storage({
    accessToken: 'signed-access-token',
    activeUserId: '64c000000000000000000001'
  }));
  assert.equal(result.headers.Authorization, 'Bearer signed-access-token');
  assert.equal(result.expectedUserId, '64c000000000000000000001');
});

test('refuses to synchronize a queued sale under another staff account', () => {
  assert.throws(() => getSessionAuthConfig('64c000000000000000000001', storage({
    accessToken: 'another-session-token',
    activeUserId: '64c000000000000000000002'
  })), /account changed/);
});

test('requires an established active browser session', () => {
  assert.throws(() => getSessionAuthConfig('64c000000000000000000001', storage()), /verified staff session/);
});
