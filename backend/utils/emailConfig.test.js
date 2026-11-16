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

test('classifies intentional delivery policy and configuration blocks separately from provider failures', () => {
  const { isEmailDeliveryBlocked } = require('./emailConfig');
  assert.equal(isEmailDeliveryBlocked({ code: 'EMAIL_DELIVERY_DISABLED' }), true);
  assert.equal(isEmailDeliveryBlocked({ code: 'EMAIL_DOMAIN_NOT_VERIFIED' }), true);
  assert.equal(isEmailDeliveryBlocked({ code: 'EMAIL_TEST_RECIPIENT_NOT_ALLOWED' }), true);
  assert.equal(isEmailDeliveryBlocked({ code: 'RESEND_RATE_LIMIT' }), false);
  assert.equal(isEmailDeliveryBlocked({ code: 'RESEND_REJECTED' }), false);
  assert.equal(isEmailDeliveryBlocked(new Error('other error')), false);
});


test('email diagnostics identify missing backend configuration without exposing secrets', () => {
  const config = getEmailConfig({});
  assert.ok(config.issues.some(issue => issue.includes('EMAIL_DELIVERY_MODE')));
  assert.ok(config.issues.some(issue => issue.includes('RESEND_API_KEY')));
  assert.ok(config.issues.some(issue => issue.includes('EMAIL_FROM')));
  assert.equal(JSON.stringify(config).includes('re_live_key'), false);
});

test('test mode diagnostics require an explicit allow-list', () => {
  const config = getEmailConfig({
    EMAIL_DELIVERY_MODE: 'test',
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'Abdulmula Test <onboarding@resend.dev>',
    EMAIL_TEST_RECIPIENTS: ''
  });
  assert.equal(config.providerReady, true);
  assert.equal(config.testRecipientCount, 0);
  assert.ok(config.issues.some(issue => issue.includes('EMAIL_TEST_RECIPIENTS')));
});

test('live diagnostics report a verified sender-domain mismatch', () => {
  const config = getEmailConfig({
    EMAIL_DELIVERY_MODE: 'live',
    RESEND_API_KEY: 're_live_key',
    EMAIL_FROM: 'Abdulmula <noreply@other-domain.example>',
    EMAIL_SENDING_DOMAIN: 'abdulmulafashion.com',
    EMAIL_DOMAIN_VERIFIED: 'true'
  });
  assert.equal(config.domainVerified, true);
  assert.equal(config.senderDomainMatches, false);
  assert.ok(config.issues.some(issue => issue.includes('EMAIL_FROM')));
});
