import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import type { TokenPair } from '@/types';

type AuthBindings = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (pair: TokenPair) => void;
  logout: () => void;
};

let bindings: AuthBindings = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (pair) => useAuthStore.getState().setTokens(pair),
  logout: () => useAuthStore.getState().logout(),
};

export function bindAuthStore(next: AuthBindings) {
  bindings = next;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add access token to every request
api.interceptors.request.use((config) => {
  const token = bindings.getAccessToken();

  if (config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Refresh queue: only one refresh in-flight at a time ────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      // If a refresh is already running, queue this request until it completes
      if (isRefreshing) {
        return new Promise<string>((resolve) => {
          refreshQueue.push(resolve);
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = bindings.getRefreshToken();

        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh-token`,
          { refreshToken }
        );

        const tokenPair = response.data.data;
        bindings.setTokens(tokenPair);

        processQueue(tokenPair.accessToken);

        originalRequest.headers.Authorization =
          `Bearer ${tokenPair.accessToken}`;

        return api(originalRequest);
      } catch (err) {
        refreshQueue = [];

        if (axios.isAxiosError(err) && !err.response) {
          return Promise.reject(err);
        }

        bindings.logout();
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message;
    if (message && !isAuthEndpoint) toast.error(message);
    return Promise.reject(error);
  }
);

export default api;
