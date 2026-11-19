function validateProductionSecurity(env = process.env) {
  if (env.NODE_ENV !== 'production') return true;

  if (!env.CLIENT_URL) {
    throw new Error('CLIENT_URL must be configured in production.');
  }
  if (!env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL must be configured in production.');
  }

  for (const key of ['CLIENT_URL', 'CLIENT_PREVIEW_URL', 'FRONTEND_URL']) {
    const configured = String(env[key] || '').trim();
    if (!configured) continue;

    const values = key === 'CLIENT_URL' || key === 'CLIENT_PREVIEW_URL'
      ? configured.split(',')
      : [configured];

    for (const value of values) {
      const candidate = value.trim();
      let parsed;
      try {
        parsed = new URL(candidate);
      } catch {
        throw new Error(`${key} must contain valid HTTPS URL(s) in production.`);
      }

      if (parsed.protocol !== 'https:' || parsed.origin !== (candidate.endsWith('/') ? candidate.slice(0, -1) : candidate)) {
        throw new Error(`${key} must contain HTTPS origin(s) only in production.`);
      }
    }
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = String(env[key] || '');
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error(`${key} must be at least 32 bytes in production. Generate a new random secret.`);
    }
  }

  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  return true;
}

module.exports = { validateProductionSecurity };
