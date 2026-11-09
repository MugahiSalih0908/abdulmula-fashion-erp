import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const storedAccessToken = localStorage.getItem('accessToken');
const storedRefreshToken = localStorage.getItem('refreshToken');

if (storedAccessToken === 'undefined' || storedAccessToken === 'null') {
  localStorage.removeItem('accessToken');
}

if (storedRefreshToken === 'undefined' || storedRefreshToken === 'null') {
  localStorage.removeItem('refreshToken');
}

const useAuthStore = create((set, get) => ({
  user: null,

  accessToken:
    localStorage.getItem('accessToken') && localStorage.getItem('accessToken') !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null,

  refreshToken:
    localStorage.getItem('refreshToken') &&
    localStorage.getItem('refreshToken') !== 'undefined' &&
    localStorage.getItem('refreshToken') !== 'null'
      ? localStorage.getItem('refreshToken')
      : null,

  isLoading: false,

  fetchMe: async () => {
    const token = get().accessToken;

    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        get().logout();
        return;
      }

      const data = await response.json();

      set({
        user: data.data || null,
      });
    } catch (error) {
      console.error('Fetch me failed:', error);
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    set({
      accessToken,
      refreshToken,
    });
  },

  isAdmin: () => {
    return get().user?.role === 'admin';
  },

  isManager: () => {
    return ['admin', 'manager'].includes(get().user?.role);
  },
}));

export default useAuthStore;
