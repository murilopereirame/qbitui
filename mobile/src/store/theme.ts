import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { logger } from '@/lib/logger';

/** Theme preference, as chosen by the user. */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

const STORAGE_KEY = 'qbitui.theme';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Tells the platform about the preference too, so native surfaces (status bar,
 * keyboard, native controls) match the app.  'unspecified' hands control back
 * to the system.  It does nothing below iOS 13 / Android 10, and the API is
 * missing altogether on react-native-web — which is why the mode is also
 * resolved in JS by `useColorScheme()`.
 */
function applyMode(mode: ThemeMode): void {
  Appearance.setColorScheme?.(mode === 'system' ? 'unspecified' : mode);
}

interface ThemeState {
  mode: ThemeMode;
  /** False until the stored preference has been read back. */
  isHydrated: boolean;
  loadMode: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  isHydrated: false,

  loadMode: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const mode = isThemeMode(stored) ? stored : 'system';
      applyMode(mode);
      set({ mode, isHydrated: true });
    } catch (e) {
      logger.warn(`Failed to load theme preference: ${e instanceof Error ? e.message : String(e)}`, 'theme');
      set({ isHydrated: true });
    }
  },

  setMode: async (mode) => {
    applyMode(mode);
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      logger.warn(`Failed to save theme preference: ${e instanceof Error ? e.message : String(e)}`, 'theme');
    }
  },
}));
