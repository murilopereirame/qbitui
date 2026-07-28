/**
 * Resolves the palette for the active theme.  See `src/constants/theme.ts` for
 * the tokens and `src/store/theme.ts` for the light/dark/system preference.
 */

import { Colors, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): ThemeColors {
  return Colors[useColorScheme()];
}
