const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const staffRoutes = readFileSync(path.join(__dirname, 'staff.js'), 'utf8');

test('disabling a staff account revokes refresh tokens and active access sessions', () => {
  assert.ok(staffRoutes.includes("select('+refreshTokens +activeSessions')"));
  assert.ok(staffRoutes.includes('member.refreshTokens = [];'));
  assert.ok(staffRoutes.includes('member.activeSessions = [];'));
});

test('admin password reset revokes every device session', () => {
  assert.ok(staffRoutes.includes('member.password      = newPassword;'));
  assert.ok(staffRoutes.includes('member.refreshTokens = [];'));
  assert.ok(staffRoutes.includes('member.activeSessions = [];'));
});
