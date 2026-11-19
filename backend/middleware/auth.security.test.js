const test = require('node:test');
const assert = require('node:assert/strict');
const { isIssuedBeforePasswordChange } = require('./auth');

test('access JWTs issued before a password change are rejected', () => {
  const changedAt = new Date('2026-11-19T12:00:05.900Z');
  assert.equal(isIssuedBeforePasswordChange(1795089604, changedAt), true);
});

test('access JWTs issued in the same JWT second as a password change remain valid', () => {
  const changedAt = new Date('2026-11-19T12:00:05.900Z');
  assert.equal(isIssuedBeforePasswordChange(1795089605, changedAt), false);
});

test('accounts without password-change timestamps retain normal access-token behavior', () => {
  assert.equal(isIssuedBeforePasswordChange(undefined, null), false);
});

test('malformed access-token issue times are rejected after a password change', () => {
  assert.equal(isIssuedBeforePasswordChange(undefined, new Date()), true);
});
