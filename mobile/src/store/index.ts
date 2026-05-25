import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TorrentFilter } from '@/lib/types';
import { qbitLogin } from '@/lib/qbit-api';

const CREDS_KEY = 'qbitui:credentials';

export interface StoredCredentials {
  host: string;
  username: string;
  password: string;
  sid: string;
}

interface AuthState {
  credentials: StoredCredentials | null;
  isLoading: boolean;
  loadCredentials: () => Promise<void>;
  saveCredentials: (creds: StoredCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  updateSid: (sid: string) => Promise<void>;
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

export const useAuthStore = create<AuthState>((set, get) => ({
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

  updateSid: async (sid: string) => {
    const { credentials } = get();
    if (!credentials) return;
    const updated = { ...credentials, sid };
    await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(updated));
    set({ credentials: updated });
  },
}));

// Mutex to prevent concurrent session refresh attempts
let pendingSessionRefresh: Promise<string | null> | null = null;

export async function refreshSession(): Promise<string | null> {
  if (pendingSessionRefresh) return pendingSessionRefresh;

  pendingSessionRefresh = (async () => {
    try {
      const { credentials, updateSid, clearCredentials } = useAuthStore.getState();
      if (!credentials?.password) {
        await clearCredentials();
        return null;
      }
      const { sid } = await qbitLogin(credentials.host, credentials.username, credentials.password);
      await updateSid(sid);
      return sid;
    } catch {
      const { clearCredentials } = useAuthStore.getState();
      await clearCredentials();
      return null;
    } finally {
      pendingSessionRefresh = null;
    }
  })();

  return pendingSessionRefresh;
}

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
