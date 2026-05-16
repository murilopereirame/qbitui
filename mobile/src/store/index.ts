import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TorrentFilter } from '@/lib/types';

const CREDS_KEY = 'qbitui:credentials';

export interface StoredCredentials {
  host: string;
  username: string;
  sid: string;
}

interface AuthState {
  credentials: StoredCredentials | null;
  isLoading: boolean;
  loadCredentials: () => Promise<void>;
  saveCredentials: (creds: StoredCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
}

interface UIState {
  filter: TorrentFilter;
  search: string;
  activeTorrentHash: string | undefined;
  isAddModalOpen: boolean;
  setFilter: (filter: TorrentFilter) => void;
  setSearch: (search: string) => void;
  setActiveTorrentHash: (hash?: string) => void;
  setAddModalOpen: (open: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  credentials: null,
  isLoading: true,

  loadCredentials: async () => {
    try {
      const raw = await AsyncStorage.getItem(CREDS_KEY);
      if (raw) {
        set({ credentials: JSON.parse(raw) as StoredCredentials, isLoading: false });
      } else {
        set({ credentials: null, isLoading: false });
      }
    } catch {
      set({ credentials: null, isLoading: false });
    }
  },

  saveCredentials: async (creds: StoredCredentials) => {
    await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(creds));
    set({ credentials: creds });
  },

  clearCredentials: async () => {
    await AsyncStorage.removeItem(CREDS_KEY);
    set({ credentials: null });
  },
}));

export const useUIStore = create<UIState>((set) => ({
  filter: 'all',
  search: '',
  activeTorrentHash: undefined,
  isAddModalOpen: false,
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  setActiveTorrentHash: (activeTorrentHash) => set({ activeTorrentHash }),
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
}));
