const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const invitationRoutes = readFileSync(path.join(__dirname, 'invitations.js'), 'utf8');

test('invitation auto-login creates a revocable device session', () => {
  assert.ok(invitationRoutes.includes('const sessionId = crypto.randomUUID()'));
  assert.ok(invitationRoutes.includes('generateAccessToken(newUser._id, sessionId)'));
  assert.ok(invitationRoutes.includes('generateRefreshToken(newUser._id, sessionId)'));
  assert.ok(invitationRoutes.includes('newUser.refreshTokens = [hashToken(refreshToken)]'));
  assert.ok(invitationRoutes.includes('newUser.activeSessions = [sessionId]'));
  assert.ok(!invitationRoutes.includes('newUser.refreshTokens = [refreshToken]'));
});
