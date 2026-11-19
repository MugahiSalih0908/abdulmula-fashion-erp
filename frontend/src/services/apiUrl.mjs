const DEFAULT_API_URL = 'https://abdulmula-fashion-erp.onrender.com/api';

function isLoopback(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(host);
}

export function resolveApiBaseUrl(configuredUrl, production = false) {
  const raw = String(configuredUrl || DEFAULT_API_URL).trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('VITE_API_URL must be an absolute HTTPS API URL.');
  }

  const isSecure = url.protocol === 'https:';
  const localDevelopmentHttp = !production && url.protocol === 'http:' && isLoopback(url.hostname);
  if (!isSecure && !localDevelopmentHttp) {
    throw new Error('The ERP API must use HTTPS. HTTP is allowed only for a loopback development server.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL cannot contain credentials, a query string or a fragment.');
  }

  const normalized = url.toString().replace(/\/+$/, '').replace(/(?:\/api)+$/i, '');
  return `${normalized}/api`;
}
