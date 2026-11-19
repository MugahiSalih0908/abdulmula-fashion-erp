const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MAX_BCRYPT_INPUT_BYTES = 72;

function validateNewPassword(value) {
  if (typeof value !== 'string') {
    return 'Password must be text.';
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_BCRYPT_INPUT_BYTES) {
    return 'Password is too long when encoded. Use at most 72 UTF-8 bytes.';
  }
  return null;
}

function isValidOpaqueToken(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_BCRYPT_INPUT_BYTES,
  validateNewPassword,
  isValidOpaqueToken
};
