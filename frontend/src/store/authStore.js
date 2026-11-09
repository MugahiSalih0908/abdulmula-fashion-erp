// src/store/authStore.js

import { create } from 'zustand';
import api from '../services/api';
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

fetchMe: async () => {

  const token = get().accessToken;

  if (!token) return;

  try {

    const { data } = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    set({
      user: data.data,
    });

  } catch (error) {
    if (error.response?.status === 401) {
      get().logout();
      return;
    }

    console.error('Fetch me failed:', error.message);
  }
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

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
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