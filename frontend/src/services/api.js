import axios from 'axios';
import { resolveApiBaseUrl } from './apiUrl.mjs';

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);

export { getSessionAuthConfig } from './sessionAuth.mjs';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const activeUserId = localStorage.getItem('activeUserId');
  if (config.expectedUserId && String(activeUserId) !== String(config.expectedUserId)) {
    throw new Error('The signed-in staff account changed. The pending request was cancelled.');
  }

  // Preserve explicitly captured credentials used by account-bound offline sync.
  const suppliedAuthorization = config.headers?.Authorization || config.headers?.authorization;
  if (!suppliedAuthorization) {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];
let refreshingUserId = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (error?.response?.status === 401 && error?.response?.data?.code === 'TOKEN_EXPIRED' && original && !original._retry) {
      const activeUserId = localStorage.getItem('activeUserId');
      if (original.expectedUserId && String(activeUserId) !== String(original.expectedUserId)) {
        return Promise.reject(new Error('The staff session changed before token refresh.'));
      }

      if (isRefreshing) {
        // Never hand one account's freshly rotated token to a request from another account.
        if (String(activeUserId) !== String(refreshingUserId)) {
          return Promise.reject(new Error('A different staff account is refreshing its session. Retry this request.'));
        }
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(token => {
            if (String(localStorage.getItem('activeUserId')) !== String(refreshingUserId)) {
              throw new Error('The staff session changed while waiting for token refresh.');
            }
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          });
      }
      original._retry = true;
      isRefreshing = true;
      refreshingUserId = activeUserId;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        if (String(localStorage.getItem('activeUserId')) !== String(refreshingUserId)) {
          throw new Error('The staff session changed during token refresh. Sign in again.');
        }
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        processQueue(null, data.data.accessToken);

        // The logout body must revoke the newly rotated token, not the consumed token.
        if (original.url?.replace(/^\\//, '') === 'auth/logout' && original.data && typeof original.data === 'object') {
          original.data = { ...original.data, refreshToken: data.data.refreshToken };
        }
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (!refreshingUserId || String(localStorage.getItem('activeUserId')) === String(refreshingUserId)) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('activeUserId');
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
        refreshingUserId = null;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
