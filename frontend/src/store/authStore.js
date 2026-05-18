// src/store/authStore.js

import { create } from 'zustand';
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

    const response = await fetch(
      'http://localhost:5000/api/auth/me',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      get().logout();
      return;
    }

    const data = await response.json();

    set({
      user: data.data,
    });

  } catch (error) {
    console.error('Fetch me failed:', error);
  }
},

  // ─────────────────────────────
  // LOGIN
  // ─────────────────────────────

  login: async (email, password) => {

    set({ isLoading: true });

    try {

      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {

        set({ isLoading: false });

        return {
          success: false,
          message: data.message || 'Login failed',
          code: data.code || null,
        };
      }

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
        message: 'Server connection failed',
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