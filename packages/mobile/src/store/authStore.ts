import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  host: string;
  sid: string;
  username: string;
  setAuth: (host: string, sid: string, username: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  host: '',
  sid: '',
  username: '',
  setAuth: (host, sid, username) => {
    set({ host, sid, username });
    SecureStore.setItemAsync('auth', JSON.stringify({ host, sid, username })).catch(() => {});
  },
  clearAuth: () => {
    set({ host: '', sid: '', username: '' });
    SecureStore.deleteItemAsync('auth').catch(() => {});
  },
}));
