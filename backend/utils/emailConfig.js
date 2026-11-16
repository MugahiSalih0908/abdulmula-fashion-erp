const VALID_MODES = new Set(['disabled', 'test', 'live']);

function getSenderAddress(sender) {
  const bracketed = String(sender || '').match(/<([^<>]+)>/);
  return String(bracketed ? bracketed[1] : sender || '').trim().toLowerCase();
}

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

  const senderAddress = getSenderAddress(sender);
  const senderDomain = senderAddress.includes('@') ? senderAddress.split('@').pop() : '';
  const configuredDomain = String(env.EMAIL_SENDING_DOMAIN || '').trim().toLowerCase();
  const senderDomainMatches = Boolean(
    configuredDomain &&
    senderDomain &&
    senderDomain !== 'resend.dev' &&
    senderDomain === configuredDomain
  );

  const issues = [];
  if (mode === 'disabled') {
    issues.push('EMAIL_DELIVERY_MODE is disabled. Set it to test for an allow-listed inbox, or live after verifying the sending domain.');
  }
  if (!hasApiKey) issues.push('RESEND_API_KEY is missing from the backend environment.');
  if (!sender) issues.push('EMAIL_FROM is missing from the backend environment.');
  if (mode === 'test' && testRecipients.length === 0) {
    issues.push('EMAIL_TEST_RECIPIENTS is empty. Add the exact test inboxes that may receive test messages.');
  }
  if (mode === 'live' && !domainVerified) {
    issues.push('The sending domain is not marked as verified. Verify it with Resend before enabling live delivery.');
  }
  if (mode === 'live' && !senderDomainMatches) {
    issues.push('EMAIL_FROM must use an address on the verified EMAIL_SENDING_DOMAIN.');
  }

  return {
    mode,
    enabled: mode !== 'disabled',
    providerReady: hasApiKey && Boolean(sender),
    senderConfigured: Boolean(sender),
    domainVerified,
    senderDomainMatches,
    testRecipientCount: testRecipients.length,
    issues
  };
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
  if (!config.senderDomainMatches) {
    const error = new Error('EMAIL_FROM must use the verified EMAIL_SENDING_DOMAIN in live mode.');
    error.code = 'EMAIL_SENDER_DOMAIN_MISMATCH';
    error.statusCode = 400;
    throw error;
  }
  return config;
}

const BLOCKED_EMAIL_CODES = Object.freeze([
  'EMAIL_DELIVERY_DISABLED',
  'EMAIL_CONFIGURATION_ERROR',
  'EMAIL_TEST_RECIPIENT_NOT_ALLOWED',
  'EMAIL_DOMAIN_NOT_VERIFIED',
  'EMAIL_SENDER_DOMAIN_MISMATCH'
]);

function isEmailDeliveryBlocked(error) {
  return Boolean(error && BLOCKED_EMAIL_CODES.includes(error.code));
}

module.exports = {
  getEmailConfig,
  validateEmailDelivery,
  getSenderAddress,
  BLOCKED_EMAIL_CODES,
  isEmailDeliveryBlocked
};
