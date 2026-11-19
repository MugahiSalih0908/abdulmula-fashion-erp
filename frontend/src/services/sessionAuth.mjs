export function getSessionAuthConfig(expectedUserId, storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new Error('Browser session storage is unavailable.');
  }
  const accessToken = storage.getItem('accessToken');
  const activeUserId = storage.getItem('activeUserId');
  if (!accessToken || !activeUserId) {
    throw new Error('A verified staff session is required for this action.');
  }
  if (expectedUserId && String(activeUserId) !== String(expectedUserId)) {
    throw new Error('The signed-in staff account changed. Sign in again before synchronizing this sale.');
  }
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}
