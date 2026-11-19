// src/store/authStore.js

import { create } from 'zustand';
import api from '../services/api';

// React StrictMode and protected route transitions may request the current user together.
// Share one in-flight request so the same access token is not checked multiple times.
let fetchMeInFlight = null;
const storedAccessToken = localStorage.getItem('accessToken');
const storedRefreshToken = localStorage.getItem('refreshToken');

const getTokenUserId = token => {
  try {
    const encoded = token?.split('.')?.[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)).id || null;
  } catch {
    return null;
  }
};

const storedOfflineUserId = localStorage.getItem('offlineUserId') || getTokenUserId(storedAccessToken);
if (storedOfflineUserId) localStorage.setItem('offlineUserId', storedOfflineUserId);

if (
  storedAccessToken === 'undefined' ||
  storedAccessToken === 'null'
) {
  localStorage.removeItem('accessToken');
}

if (
  storedRefreshToken === 'undefined' ||
  storedRefreshToken === 'null'
) {
  localStorage.removeItem('refreshToken');
}


const useAuthStore = create((set, get) => ({

  // ─────────────────────────────
  // STATE
  // ─────────────────────────────

  user: null,
  // Used only to partition local offline data. API authorization still relies on signed JWTs.
  offlineUserId: storedOfflineUserId,

  accessToken: (
  localStorage.getItem('accessToken') &&
  localStorage.getItem('accessToken') !== 'undefined'
)
  ? localStorage.getItem('accessToken')
  : null,

  refreshToken: (
  localStorage.getItem('refreshToken') &&
  localStorage.getItem('refreshToken') !== 'undefined' &&
  localStorage.getItem('refreshToken') !== 'null'
)
  ? localStorage.getItem('refreshToken')
  : null,

  isLoading: false,
  // ─────────────────────────────
// FETCH CURRENT USER
// ─────────────────────────────

fetchMe: () => {
  const token = get().accessToken;
  if (!token) return Promise.resolve();
  if (fetchMeInFlight) return fetchMeInFlight;

  fetchMeInFlight = (async () => {
    try {
      const { data } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ignore stale results if the user signed out or changed accounts mid-request.
      if (get().accessToken === token) {
        const offlineUserId = data.data?._id || data.data?.id || getTokenUserId(token);
        if (offlineUserId) localStorage.setItem('offlineUserId', String(offlineUserId));
        set({ user: data.data, offlineUserId: offlineUserId ? String(offlineUserId) : null });
      }
    } catch (error) {
      if (error.response?.status === 401 && get().accessToken === token) {
        get().logout();
        return;
      }

      console.error('Fetch me failed:', error.message);
    } finally {
      fetchMeInFlight = null;
    }
  })();

  return fetchMeInFlight;
},

  // ─────────────────────────────
  // LOGIN
  // ─────────────────────────────

  login: async (email, password) => {

    set({ isLoading: true });

    try {

      const { data } = await api.post('/auth/login', { email, password });

      const { user, accessToken, refreshToken } = data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      const offlineUserId = user?._id || user?.id || getTokenUserId(accessToken);
      if (offlineUserId) localStorage.setItem('offlineUserId', String(offlineUserId));

      set({
        user,
        offlineUserId: offlineUserId ? String(offlineUserId) : null,
        accessToken,
        refreshToken,
        isLoading: false,
      });

      return {
        success: true,
      };

    } catch (error) {

      set({ isLoading: false });

      return {
        success: false,
        message:
          error.response?.data?.message ||
          (error.code === 'ECONNABORTED'
            ? 'The server took too long to respond. Please try again.'
            : error.code === 'ERR_NETWORK'
              ? 'Unable to reach the server. Check your connection and try again.'
              : 'Unable to sign in. Please try again.'),
        code: error.response?.data?.code || null,
      };
    }
  },

  // ─────────────────────────────
  // LOGOUT
  // ─────────────────────────────

  logout: () => {
    const accessToken = localStorage.getItem('accessToken') || get().accessToken;
    const refreshToken = localStorage.getItem('refreshToken') || get().refreshToken;

    // Revoke this device's refresh token on the server; local sign-out never waits for the network.
    if (accessToken && refreshToken) {
      api.post('/auth/logout', { refreshToken }, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 3000
      }).catch(() => {});
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('offlineUserId');
    // Prevent a different cashier inheriting the previous cashier's unfinished checkout ID.
    localStorage.removeItem('pos.pendingCheckoutId');
    localStorage.removeItem('pos.pendingCheckoutCreatedAt');

    set({
      user: null,
      offlineUserId: null,
      accessToken: null,
      refreshToken: null,
    });
  },

  // ─────────────────────────────
  // SET AUTH (invitation auto-login)
  // ─────────────────────────────

  setAuth: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const offlineUserId = user?._id || user?.id || getTokenUserId(accessToken);
    if (offlineUserId) localStorage.setItem('offlineUserId', String(offlineUserId));
    set({
      user,
      offlineUserId: offlineUserId ? String(offlineUserId) : null,
      accessToken,
      refreshToken
    });
  },

  // ─────────────────────────────
  // SET TOKENS
  // ─────────────────────────────

  setTokens: (accessToken, refreshToken) => {

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const offlineUserId = getTokenUserId(accessToken);
    if (offlineUserId) localStorage.setItem('offlineUserId', offlineUserId);

    set({
      offlineUserId: offlineUserId || get().offlineUserId,
      accessToken,
      refreshToken,
    });
  },

  // ─────────────────────────────
  // ROLE HELPERS
  // ─────────────────────────────

  isAdmin: () => {
    return get().user?.role === 'admin';
  },

  isManager: () => {
    return ['admin', 'manager'].includes(get().user?.role);
  },

}));

export default useAuthStore;