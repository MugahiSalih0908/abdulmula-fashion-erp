function isAllowedBrowserOrigin({ origin, allowedOrigins, isProduction }) {
  if (!origin) return true;
  if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) return true;
  return !isProduction && origin === 'http://localhost:5173';
}

module.exports = { isAllowedBrowserOrigin };
