import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/store';
import { useSettingsStore } from '@/store/settings';
import { useThemeStore } from '@/store/theme';

SplashScreen.preventAutoHideAsync();

logger.info('App started', 'app');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(`Query failed (attempt ${failureCount + 1}): ${msg}`, 'query');
        return failureCount < 2;
      },
    },
  },
});

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { credentials, isLoading, loadCredentials } = useAuthStore();

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    const inProtectedGroup =
      segments[0] === '(tabs)' || segments[0] === 'torrent' || segments[0] === 'labels';

    if (!credentials && inProtectedGroup) {
      router.replace('/login');
    } else if (credentials && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [credentials, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const loadThemeMode = useThemeStore((s) => s.loadMode);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Restore saved preferences on launch.
  useEffect(() => {
    loadThemeMode();
    loadSettings();
  }, [loadThemeMode, loadSettings]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="torrent/[hash]"
            options={{ headerShown: true, title: 'Torrent Details', presentation: 'card' }}
          />
          <Stack.Screen
            name="logs"
            options={{ headerShown: true, title: 'App Logs', presentation: 'card', headerBackTitle: 'Settings' }}
          />
          <Stack.Screen
            name="labels"
            options={{ headerShown: true, title: 'Categories & Tags', presentation: 'card' }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
