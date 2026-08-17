import { create } from 'zustand';
import * as Keychain from 'react-native-keychain';
import { TaxonomyFilter, TorrentFilter } from '@/lib/types';
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

export type SortField = 'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'eta' | 'added_on';
export type SortDir = 'asc' | 'desc';

interface UIState {
  filter: TorrentFilter;
  /** Selected category: null shows every category, '' only uncategorised torrents. */
  categoryFilter: TaxonomyFilter;
  /** Selected tag: null shows every tag, '' only untagged torrents. */
  tagFilter: TaxonomyFilter;
  search: string;
  activeTorrentHash: string | undefined;
  isAddModalOpen: boolean;
  selectionMode: boolean;
  selectedHashes: Set<string>;
  sortField: SortField;
  sortDir: SortDir;
  setFilter: (filter: TorrentFilter) => void;
  setCategoryFilter: (category: TaxonomyFilter) => void;
  setTagFilter: (tag: TaxonomyFilter) => void;
  setSearch: (search: string) => void;
  setActiveTorrentHash: (hash?: string) => void;
  setAddModalOpen: (open: boolean) => void;
  enterSelectionMode: (hash: string) => void;
  toggleSelection: (hash: string) => void;
  selectAll: (hashes: string[]) => void;
  clearSelection: () => void;
  toggleSort: (field: SortField) => void;
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
  categoryFilter: null,
  tagFilter: null,
  search: '',
  activeTorrentHash: undefined,
  isAddModalOpen: false,
  selectionMode: false,
  selectedHashes: new Set<string>(),
  sortField: 'added_on',
  sortDir: 'desc',
  setFilter: (filter) => set({ filter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSearch: (search) => set({ search }),
  setActiveTorrentHash: (activeTorrentHash) => set({ activeTorrentHash }),
  setAddModalOpen: (open) => set({ isAddModalOpen: open }),
  enterSelectionMode: (hash) => set({ selectionMode: true, selectedHashes: new Set([hash]) }),
  toggleSelection: (hash) =>
    set((s) => {
      const next = new Set(s.selectedHashes);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return { selectedHashes: next };
    }),
  selectAll: (hashes) => set({ selectedHashes: new Set(hashes) }),
  clearSelection: () => set({ selectionMode: false, selectedHashes: new Set<string>() }),
  toggleSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDir: s.sortField === field ? (s.sortDir === 'asc' ? 'desc' : 'asc') : 'desc',
    })),
}));
