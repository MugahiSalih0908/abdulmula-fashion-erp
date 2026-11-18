const test = require('node:test');
const assert = require('node:assert/strict');
const { mapResendEvent, shouldApplyEmailEvent } = require('./emailStatus');

test('maps supported Resend delivery events to application statuses', () => {
  assert.equal(mapResendEvent('email.sent'), 'sent');
  assert.equal(mapResendEvent('email.delivered'), 'delivered');
  assert.equal(mapResendEvent('email.delivery_delayed'), 'delivery_delayed');
  assert.equal(mapResendEvent('email.bounced'), 'bounced');
  assert.equal(mapResendEvent('email.complained'), 'complained');
  assert.equal(mapResendEvent('email.unknown'), null);
});

test('ignores older webhook events', () => {
  assert.equal(shouldApplyEmailEvent('delivered', new Date('2026-11-16T10:00:00Z'), 'sent', new Date('2026-11-16T09:59:00Z')), false);
});

test('allows a newer delivery event to update sent status', () => {
  assert.equal(shouldApplyEmailEvent('sent', new Date('2026-11-16T09:00:00Z'), 'delivered', new Date('2026-11-16T09:01:00Z')), true);
});

test('does not regress terminal delivery states to non-terminal states', () => {
  assert.equal(shouldApplyEmailEvent('delivered', new Date('2026-11-16T09:00:00Z'), 'sent', new Date('2026-11-16T09:02:00Z')), false);
});
