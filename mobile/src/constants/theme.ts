/**
 * The app's colour palette, defined once per theme.  Screens never hardcode a
 * colour: they read these tokens through `useTheme()` so the same styles work
 * in both the light and the dark theme.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Surfaces
    background: '#f4f6f9',
    chrome: '#eef1f6',
    surface: '#ffffff',
    surfaceRaised: '#e8eaee',
    card: '#ffffff',
    overlay: 'rgba(15,23,42,0.4)',

    // Legacy aliases kept for ThemedView / ThemedText / Collapsible.
    backgroundElement: '#e8eaee',
    backgroundSelected: '#dbeafe',

    // Text
    text: '#0f172a',
    textSecondary: '#4b5563',
    textSubtle: '#6b7280',
    textInverted: '#ffffff',
    placeholder: '#94a3b8',

    // Lines
    border: '#dfe3ea',
    borderStrong: '#cbd5e1',

    // Accent
    accent: '#2563eb',
    accentStrong: '#1d4ed8',
    accentSoft: '#dbeafe',
    accentText: '#1d4ed8',
    accentBorder: '#93c5fd',

    // Selection mode bars
    selectionBar: '#dbeafe',
    selectionSurface: '#eff6ff',
    selectionBorder: '#bfdbfe',

    // Destructive
    danger: '#dc2626',
    dangerSoft: '#fee2e2',
    dangerBorder: '#fecaca',
    dangerText: '#b91c1c',

    // Torrent state colours
    stateBlue: '#2563eb',
    stateGreen: '#15803d',
    stateYellow: '#b45309',
    stateGray: '#6b7280',
    statePurple: '#7e22ce',
    stateOrange: '#c2410c',
    stateRed: '#dc2626',
    stateCyan: '#0e7490',
  },
  dark: {
    // Surfaces
    background: '#030712',
    chrome: '#030712',
    surface: '#111827',
    surfaceRaised: '#1f2937',
    card: '#0f172a',
    overlay: 'rgba(0,0,0,0.6)',

    // Legacy aliases kept for ThemedView / ThemedText / Collapsible.
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',

    // Text
    text: '#f1f5f9',
    textSecondary: '#9ca3af',
    textSubtle: '#6b7280',
    textInverted: '#ffffff',
    placeholder: '#555555',

    // Lines
    border: '#1f2937',
    borderStrong: '#374151',

    // Accent
    accent: '#3b82f6',
    accentStrong: '#2563eb',
    accentSoft: '#1e3a5f',
    accentText: '#93c5fd',
    accentBorder: '#3b82f6',

    // Selection mode bars
    selectionBar: '#0f1e3d',
    selectionSurface: '#0b1730',
    selectionBorder: '#1e3a5f',

    // Destructive
    danger: '#ef4444',
    dangerSoft: '#450a0a',
    dangerBorder: '#7f1d1d',
    dangerText: '#fca5a5',

    // Torrent state colours
    stateBlue: '#3b82f6',
    stateGreen: '#22c55e',
    stateYellow: '#eab308',
    stateGray: '#6b7280',
    statePurple: '#a855f7',
    stateOrange: '#f97316',
    stateRed: '#ef4444',
    stateCyan: '#06b6d4',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** The resolved palette for whichever theme is active. */
export type ThemeColors = { [K in ThemeColor]: string };

/** Maps the colour key returned by `getStateColor()` onto a palette entry. */
export function stateColor(colors: ThemeColors, key: string): string {
  const token = `state${key.charAt(0).toUpperCase()}${key.slice(1)}` as ThemeColor;
  return colors[token] ?? colors.stateGray;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
