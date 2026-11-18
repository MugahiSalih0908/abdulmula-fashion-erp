const EVENT_STATUS = Object.freeze({
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'bounced'
});

const TERMINAL_STATUSES = new Set(['delivered', 'bounced', 'complained']);

function mapResendEvent(eventType) {
  return EVENT_STATUS[eventType] || null;
}

function shouldApplyEmailEvent(currentStatus, currentEventAt, nextStatus, nextEventAt) {
  if (!nextStatus || !nextEventAt) return false;
  if (!currentEventAt) return true;
  if (new Date(nextEventAt).getTime() < new Date(currentEventAt).getTime()) return false;
  if (TERMINAL_STATUSES.has(currentStatus) && !TERMINAL_STATUSES.has(nextStatus)) return false;
  return true;
}

module.exports = { mapResendEvent, shouldApplyEmailEvent };
