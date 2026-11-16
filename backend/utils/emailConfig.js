const VALID_MODES = new Set(['disabled', 'test', 'live']);

function getEmailConfig(env = process.env) {
  const configuredMode = String(env.EMAIL_DELIVERY_MODE || 'disabled').trim().toLowerCase();
  const mode = VALID_MODES.has(configuredMode) ? configuredMode : 'disabled';
  const sender = String(env.EMAIL_FROM || '').trim();
  const hasApiKey = Boolean(String(env.RESEND_API_KEY || '').trim());
  const domainVerified = String(env.EMAIL_DOMAIN_VERIFIED || '').toLowerCase() === 'true';
  const testRecipients = String(env.EMAIL_TEST_RECIPIENTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return {
    mode,
    enabled: mode !== 'disabled',
    providerReady: hasApiKey && Boolean(sender),
    senderConfigured: Boolean(sender),
    domainVerified,
    testRecipientCount: testRecipients.length
  };
}

function getSenderAddress(sender) {
  const bracketed = String(sender || '').match(/<([^<>]+)>/);
  return String(bracketed ? bracketed[1] : sender || '').trim().toLowerCase();
}

function validateEmailDelivery({ recipient, env = process.env }) {
  const config = getEmailConfig(env);
  if (config.mode === 'disabled') {
    const error = new Error('Email delivery is disabled. Set EMAIL_DELIVERY_MODE=test or live after configuring the provider.');
    error.code = 'EMAIL_DELIVERY_DISABLED';
    error.statusCode = 403;
    throw error;
  }
  if (!config.providerReady) {
    const error = new Error('RESEND_API_KEY and EMAIL_FROM must be configured before sending.');
    error.code = 'EMAIL_CONFIGURATION_ERROR';
    error.statusCode = 400;
    throw error;
  }
  if (config.mode === 'test') {
    const allowed = String(env.EMAIL_TEST_RECIPIENTS || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(String(recipient || '').trim().toLowerCase())) {
      const error = new Error('Test mode can send only to an address listed in EMAIL_TEST_RECIPIENTS.');
      error.code = 'EMAIL_TEST_RECIPIENT_NOT_ALLOWED';
      error.statusCode = 403;
      throw error;
    }
    return config;
  }
  if (!config.domainVerified) {
    const error = new Error('Live email delivery is blocked until the sending domain is verified.');
    error.code = 'EMAIL_DOMAIN_NOT_VERIFIED';
    error.statusCode = 403;
    throw error;
  }
  const senderAddress = getSenderAddress(env.EMAIL_FROM);
  const senderDomain = senderAddress.split('@').pop();
  const configuredDomain = String(env.EMAIL_SENDING_DOMAIN || '').trim().toLowerCase();
  if (!senderAddress.includes('@') || !senderDomain || senderDomain === 'resend.dev' ||
      (configuredDomain && senderDomain !== configuredDomain)) {
    const error = new Error('EMAIL_FROM must use the verified EMAIL_SENDING_DOMAIN in live mode.');
    error.code = 'EMAIL_SENDER_DOMAIN_MISMATCH';
    error.statusCode = 400;
    throw error;
  }
  return config;
}

module.exports = { getEmailConfig, validateEmailDelivery, getSenderAddress, BLOCKED_EMAIL_CODES, isEmailDeliveryBlocked };

const BLOCKED_EMAIL_CODES = Object.freeze(["EMAIL_DELIVERY_DISABLED","EMAIL_CONFIGURATION_ERROR","EMAIL_TEST_RECIPIENT_NOT_ALLOWED","EMAIL_DOMAIN_NOT_VERIFIED","EMAIL_SENDER_DOMAIN_MISMATCH"]);

function isEmailDeliveryBlocked(error) {
  return Boolean(error && BLOCKED_EMAIL_CODES.includes(error.code));
}
