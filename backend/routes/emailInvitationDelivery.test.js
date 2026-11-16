const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = relativePath => readFileSync(path.join(__dirname, relativePath), 'utf8');

test('invitation creation keeps the pending invitation when email delivery fails', () => {
  const route = read('./invitations.js');
  const start = route.indexOf("router.post('/create'");
  const end = route.indexOf("router.get('/',", start);
  const createRoute = route.slice(start, end);

  assert.match(createRoute, /invitation\.emailStatus = emailStatus/);
  assert.match(createRoute, /Keep the invitation and token/);
  assert.match(createRoute, /emailStatus/);
  assert.doesNotMatch(createRoute, /Invitation\.findByIdAndDelete/);
});

test('invitation resend restores the previous token after a definite email failure', () => {
  const route = read('./invitations.js');
  const start = route.indexOf("router.post('/resend'");
  const end = route.indexOf("router.delete('/:id'", start);
  const resendRoute = route.slice(start, end);

  assert.match(resendRoute, /invitation\.token = previous\.token/);
  assert.match(resendRoute, /invitation\.emailStatus = emailStatus/);
  assert.match(resendRoute, /emailErrorMessage/);
});

test('direct staff creation keeps the account and reports activation email status', () => {
  const route = read('./staff.js');
  const start = route.indexOf("router.post('/', authorize('admin')");
  const end = route.indexOf("router.post('/:id/resend-activation'", start);
  const createRoute = route.slice(start, end);

  assert.match(createRoute, /await member\.save\(\)/);
  assert.match(createRoute, /emailStatus/);
  assert.match(createRoute, /activation email/);
  assert.doesNotMatch(createRoute, /User\.findByIdAndDelete/);
});
