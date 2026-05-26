import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';
import { TorrentFilter } from '@/lib/types';
import { logger } from '@/lib/logger';

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
        logger.info(`Credentials loaded for host: ${result.username}`, 'store');
        // username field stores host, password field stores apiToken
        set({ credentials: { host: result.username, apiToken: result.password }, isLoading: false });
      } else {
        logger.info('No saved credentials found', 'store');
        set({ credentials: null, isLoading: false });
      }
    } catch (e) {
      logger.error(`Failed to load credentials: ${e instanceof Error ? e.message : String(e)}`, 'store');
      set({ credentials: null, isLoading: false });
    }
  },

  saveCredentials: async (creds: StoredCredentials) => {
    await Keychain.setGenericPassword(creds.host, creds.apiToken, { service: KEYCHAIN_SERVICE });
    logger.info(`Credentials saved for host: ${creds.host}`, 'store');
    set({ credentials: creds });
  },

  clearCredentials: async () => {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    logger.info('Credentials cleared', 'store');
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
