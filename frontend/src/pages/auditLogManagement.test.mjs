import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_ACTIONS,
  filterAuditLogs,
  formatAuditDate,
  getAuditActionLabel,
  getAuditActionTone
} from './auditLogManagement.mjs';

const sampleLogs = [
  {
    action: 'LOGIN',
    userName: 'Amina',
    user: { name: 'Amina Yusuf', email: 'amina@example.test', role: 'manager' },
    entity: 'User',
    entityId: 'user-1',
    ip: '10.0.0.4',
    details: { method: 'password' }
  },
  {
    action: 'PRODUCT_DELETE',
    userName: 'Musa',
    user: { name: 'Musa Adam', role: 'admin' },
    entity: 'Product',
    entityId: 'product-7',
    ip: '10.0.0.5',
    details: { productName: 'Blue shirt' }
  }
];

test('audit action options match the current model action values', () => {
  assert.ok(AUDIT_ACTIONS.includes('OFFLINE_CONFLICT_APPROVE'));
  assert.ok(AUDIT_ACTIONS.includes('OFFLINE_CONFLICT_REJECT'));
  assert.ok(AUDIT_ACTIONS.includes('CASHBOOK_CREATE'));
  assert.equal(AUDIT_ACTIONS.length, 22);
});

test('audit search covers action, user, entity, IP and event details', () => {
  assert.deepEqual(filterAuditLogs(sampleLogs, 'amina'), [sampleLogs[0]]);
  assert.deepEqual(filterAuditLogs(sampleLogs, 'product-7'), [sampleLogs[1]]);
  assert.deepEqual(filterAuditLogs(sampleLogs, 'blue shirt'), [sampleLogs[1]]);
  assert.deepEqual(filterAuditLogs(sampleLogs, '10.0.0.4'), [sampleLogs[0]]);
});

test('audit search is case-insensitive and safely handles empty or malformed inputs', () => {
  assert.deepEqual(filterAuditLogs(sampleLogs, '  PRODUCT_DELETE  '), [sampleLogs[1]]);
  assert.deepEqual(filterAuditLogs(sampleLogs, ''), sampleLogs);
  assert.deepEqual(filterAuditLogs(null, 'anything'), []);
  assert.deepEqual(filterAuditLogs(sampleLogs, 'not present'), []);
});

test('audit action labels and tones stay readable', () => {
  assert.equal(getAuditActionLabel('OFFLINE_CONFLICT_APPROVE'), 'OFFLINE CONFLICT APPROVE');
  assert.equal(getAuditActionTone('LOGIN'), 'success');
  assert.equal(getAuditActionTone('LOGIN_FAILED'), 'danger');
  assert.equal(getAuditActionTone('OFFLINE_CONFLICT_REJECT'), 'warning');
  assert.equal(getAuditActionTone('CASHBOOK_CREATE'), 'info');
  assert.equal(getAuditActionTone('LOGOUT'), 'primary');
});

test('audit date formatter handles valid and invalid dates', () => {
  assert.match(formatAuditDate('2026-11-16T12:00:00.000Z', 'en-US'), /2026/);
  assert.equal(formatAuditDate('not-a-date', 'en-US'), 'Date unavailable');
  assert.equal(formatAuditDate(null, 'en-US'), 'Date unavailable');
});
