import { create } from 'zustand';
import type { TokenPair, User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  setTokens: (pair: TokenPair) => void;
  logout: () => void;
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),

  setTokens: (pair) => {
    localStorage.setItem('accessToken', pair.accessToken);
    localStorage.setItem('refreshToken', pair.refreshToken);
    localStorage.setItem('user', JSON.stringify(pair.user));

    set({
      user: pair.user,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });
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
}));
