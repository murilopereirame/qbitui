"use client";

import { useSyncExternalStore } from "react";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setThemeMode,
  subscribeToTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

/**
 * Reads the current theme preference and lets it be changed.  The preference
 * lives outside React (see lib/theme) because the document is themed before
 * hydration; this hook only observes it.
 */
export function useTheme(): {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
} {
  const state = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  return { mode: state.mode, theme: state.theme, setMode: setThemeMode };
}
