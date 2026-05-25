import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';
import { TorrentFilter } from '@/lib/types';

const KEYCHAIN_SERVICE = 'qbitui';

export interface StoredCredentials {
  host: string;
  apiToken: string;
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
      const result = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
      if (result) {
        // username field stores host, password field stores apiToken
        set({ credentials: { host: result.username, apiToken: result.password }, isLoading: false });
      } else {
        set({ credentials: null, isLoading: false });
      }
    } catch {
      set({ credentials: null, isLoading: false });
    }
  },

  saveCredentials: async (creds: StoredCredentials) => {
    await Keychain.setGenericPassword(creds.host, creds.apiToken, { service: KEYCHAIN_SERVICE });
    set({ credentials: creds });
  },

  clearCredentials: async () => {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
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
