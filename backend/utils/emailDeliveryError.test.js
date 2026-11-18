const test = require('node:test');
const assert = require('node:assert/strict');
const { getEmailDeliveryError } = require('./emailDeliveryError');

test('known email delivery errors return safe actionable configuration guidance', () => {
  assert.match(getEmailDeliveryError({ code: 'EMAIL_DELIVERY_DISABLED' }).message, /EMAIL_DELIVERY_MODE/);
  assert.match(getEmailDeliveryError({ code: 'EMAIL_CONFIGURATION_ERROR' }).message, /RESEND_API_KEY/);
  assert.match(getEmailDeliveryError({ code: 'EMAIL_DOMAIN_NOT_VERIFIED' }).message, /verified/);
  assert.match(getEmailDeliveryError({ code: 'EMAIL_TEST_RECIPIENT_NOT_ALLOWED' }).message, /EMAIL_TEST_RECIPIENTS/);
});

test('provider messages are not reflected into client-facing fallback text', () => {
  const result = getEmailDeliveryError({
    code: 'RESEND_PRIVATE_ERROR',
    message: 'private provider response including secret data'
  });
  assert.doesNotMatch(result.message, /private provider response|secret data/);
});
