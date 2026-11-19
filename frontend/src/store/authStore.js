// src/store/authStore.js

import { create } from 'zustand';
import api, { revokeSession } from '../services/api';

// React StrictMode and protected route transitions may request the current user together.
// Share one in-flight request so the same access token is not checked multiple times.
let fetchMeInFlight = null;
let fetchMeToken = null;
const storedAccessToken = localStorage.getItem('accessToken');
const storedRefreshToken = localStorage.getItem('refreshToken');

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
  if (fetchMeInFlight && fetchMeToken === token) return fetchMeInFlight;

  const requestToken = token;
  fetchMeToken = requestToken;
  fetchMeInFlight = (async () => {
    try {
      const { data } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Ignore stale results if the user signed out or changed accounts mid-request.
      if (get().accessToken === requestToken) {
        localStorage.setItem('activeUserId', String(data.data._id));
        set({ user: data.data });
      }
    } catch (error) {
      if (error.response?.status === 401 && get().accessToken === requestToken) {
        get().logout();
        return;
      }

      console.error('Fetch me failed:', error.message);
    } finally {
      if (fetchMeToken === requestToken) {
        fetchMeInFlight = null;
        fetchMeToken = null;
      }
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
      localStorage.setItem('activeUserId', String(user._id));

      set({
        user,
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
    const { accessToken, refreshToken } = get();

    // Clear the shared till immediately, then best-effort revoke the captured
    // session without reading credentials from a subsequently signed-in user.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeUserId');
    set({ user: null, accessToken: null, refreshToken: null });

    if (accessToken && refreshToken) {
      revokeSession(accessToken, refreshToken).catch(() => {
        // Local sign-out still completes when the device is offline.
      });
    }
  },

  // ─────────────────────────────
  // SET TOKENS
  // ─────────────────────────────

  setTokens: (accessToken, refreshToken) => {

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    set({
      accessToken,
      refreshToken,
    });
  },

  // ─────────────────────────────
  setAuth: ({ accessToken, refreshToken, user }) => {
    if (!accessToken || !refreshToken || !user?._id) {
      throw new Error('An authenticated user and both session tokens are required.');
    }
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('activeUserId', String(user._id));
    set({ user, accessToken, refreshToken });
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