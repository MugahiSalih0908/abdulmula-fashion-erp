function validateProductionJwtSecrets(env = process.env) {
  if (env.NODE_ENV !== 'production') return true;

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = String(env[key] || '');
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(`${key} must be at least 32 bytes in production. Generate a new random secret.`);
    }
    if (new Set(secret).size < 8) {
      throw new Error(`${key} does not appear sufficiently varied. Generate a new random secret.`);
    }
  }

  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  return true;
}

module.exports = { validateProductionJwtSecrets };
