import { useMemo } from 'react';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Builds a StyleSheet from the active palette, rebuilding it only when the
 * theme actually changes.  Pass a module-level factory so the memo holds.
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
