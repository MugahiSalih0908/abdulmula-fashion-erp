const SAFE_EMAIL_ERRORS = Object.freeze({
  EMAIL_DELIVERY_DISABLED: 'Email delivery is disabled on the backend. Set EMAIL_DELIVERY_MODE to test for an allow-listed test inbox, or live after verifying your sending domain.',
  EMAIL_CONFIGURATION_ERROR: 'The Resend provider is not configured on the backend. Add RESEND_API_KEY and EMAIL_FROM to the backend deployment environment.',
  EMAIL_TEST_RECIPIENT_NOT_ALLOWED: 'The backend is in test mode, but this recipient is not listed in EMAIL_TEST_RECIPIENTS.',
  EMAIL_DOMAIN_NOT_VERIFIED: 'Live email is blocked until the sending domain is verified with Resend and EMAIL_DOMAIN_VERIFIED is set to true on the backend.',
  EMAIL_SENDER_DOMAIN_MISMATCH: 'EMAIL_FROM must use an address on the verified EMAIL_SENDING_DOMAIN.',
  EMAIL_DELIVERY_UNKNOWN: 'The provider response is uncertain. Check Email Center before retrying to avoid sending a duplicate message.',
  EMAIL_SEND_IN_PROGRESS: 'This message is already being processed. Check Email Center before trying again.'
});

function getEmailDeliveryError(error) {
  const code = String(error?.code || 'EMAIL_SEND_FAILED');
  return {
    code,
    message: SAFE_EMAIL_ERRORS[code] || 'The email provider did not accept this message. Open Email Center and review the delivery log.'
  };
}

module.exports = { getEmailDeliveryError };
