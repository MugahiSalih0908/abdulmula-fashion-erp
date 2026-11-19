function isLoopbackHost(hostname = '') {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isAllowedConfiguredOrigin(origin, { production = false } = {}) {
  try {
    const url = new URL(origin);
    if (url.origin !== String(origin).replace(/\/+$/, '')) return false;
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.protocol === 'https:') return true;
    return !production && url.protocol === 'http:' && isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function mustRejectInsecureRequest(req, production = false) {
  return Boolean(production && req?.secure !== true);
}

module.exports = { isLoopbackHost, isAllowedConfiguredOrigin, mustRejectInsecureRequest };
