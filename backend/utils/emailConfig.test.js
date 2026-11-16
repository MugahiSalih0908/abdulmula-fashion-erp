const test = require('node:test');
const assert = require('node:assert/strict');
const { getEmailConfig, validateEmailDelivery } = require('./emailConfig');

test('email delivery is disabled by default', () => {
  const config = getEmailConfig({});
  assert.equal(config.mode, 'disabled');
  assert.equal(config.enabled, false);
  assert.throws(() => validateEmailDelivery({ recipient: 'test@example.com', env: {} }), { code: 'EMAIL_DELIVERY_DISABLED' });
});

test('test mode sends only to allow-listed recipients', () => {
  const env = {
    EMAIL_DELIVERY_MODE: 'test',
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'Abdulmula Test <onboarding@resend.dev>',
    EMAIL_TEST_RECIPIENTS: 'qa@example.com, owner@example.com'
  };
  assert.equal(validateEmailDelivery({ recipient: 'QA@example.com', env }).mode, 'test');
  assert.throws(() => validateEmailDelivery({ recipient: 'other@example.com', env }), { code: 'EMAIL_TEST_RECIPIENT_NOT_ALLOWED' });
});

test('live mode requires explicit domain verification', () => {
  const env = {
    EMAIL_DELIVERY_MODE: 'live',
    RESEND_API_KEY: 're_live_key',
    EMAIL_FROM: 'Abdulmula Fashion <no-reply@abdulmulafashion.com>',
    EMAIL_SENDING_DOMAIN: 'abdulmulafashion.com',
    EMAIL_DOMAIN_VERIFIED: 'false'
  };
  assert.throws(() => validateEmailDelivery({ recipient: 'qa@example.com', env }), { code: 'EMAIL_DOMAIN_NOT_VERIFIED' });
});

test('live mode rejects sender domains that do not match the verified domain', () => {
  const env = {
    EMAIL_DELIVERY_MODE: 'live',
    RESEND_API_KEY: 're_live_key',
    EMAIL_FROM: 'Abdulmula <no-reply@resend.dev>',
    EMAIL_SENDING_DOMAIN: 'abdulmulafashion.com',
    EMAIL_DOMAIN_VERIFIED: 'true'
  };
  assert.throws(() => validateEmailDelivery({ recipient: 'qa@example.com', env }), { code: 'EMAIL_SENDER_DOMAIN_MISMATCH' });
});

test('live mode accepts only the explicitly verified sender domain', () => {
  const env = {
    EMAIL_DELIVERY_MODE: 'live',
    RESEND_API_KEY: 're_live_key',
    EMAIL_FROM: 'Abdulmula Fashion <no-reply@abdulmulafashion.com>',
    EMAIL_SENDING_DOMAIN: 'abdulmulafashion.com',
    EMAIL_DOMAIN_VERIFIED: 'true'
  };
  assert.equal(validateEmailDelivery({ recipient: 'qa@example.com', env }).mode, 'live');
});
