import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/store/theme';

export type ResolvedColorScheme = 'light' | 'dark';

/**
 * The colour scheme the app should render in: the user's preference, or the
 * system scheme while that preference is "system".
 */
export function useColorScheme(): ResolvedColorScheme {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useRNColorScheme();
  if (mode !== 'system') return mode;
  return systemScheme === 'light' ? 'light' : 'dark';
}
