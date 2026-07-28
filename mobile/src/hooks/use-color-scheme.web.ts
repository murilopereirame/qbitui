import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/store/theme';

export type ResolvedColorScheme = 'light' | 'dark';

/**
 * Web variant: static rendering has no access to the system scheme, so the
 * value is only trusted once the client has hydrated.
 */
export function useColorScheme(): ResolvedColorScheme {
  const [hasHydrated, setHasHydrated] = useState(false);
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) return 'light';
  if (mode !== 'system') return mode;
  return systemScheme === 'light' ? 'light' : 'dark';
}
