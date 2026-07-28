import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { logger } from '@/lib/logger';

const METADATA_API_KEY = 'qbitui.metadataApi';

interface SettingsState {
  /** Endpoint used to list a magnet link's files before it is added. */
  metadataApiUrl: string;
  isHydrated: boolean;
  loadSettings: () => Promise<void>;
  setMetadataApiUrl: (url: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  metadataApiUrl: '',
  isHydrated: false,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(METADATA_API_KEY);
      set({ metadataApiUrl: stored ?? '', isHydrated: true });
    } catch (e) {
      logger.warn(
        `Failed to load settings: ${e instanceof Error ? e.message : String(e)}`,
        'settings'
      );
      set({ isHydrated: true });
    }
  },

  setMetadataApiUrl: async (url) => {
    const value = url.trim();
    set({ metadataApiUrl: value });
    try {
      if (value) await AsyncStorage.setItem(METADATA_API_KEY, value);
      else await AsyncStorage.removeItem(METADATA_API_KEY);
    } catch (e) {
      logger.warn(
        `Failed to save settings: ${e instanceof Error ? e.message : String(e)}`,
        'settings'
      );
    }
  },
}));
