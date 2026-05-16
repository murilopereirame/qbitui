import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { useAuthStore } from '@/store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
    const inProtectedGroup = segments[0] === '(tabs)' || segments[0] === 'torrent';

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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="torrent/[hash]"
            options={{ headerShown: true, title: 'Torrent Details', presentation: 'card' }}
          />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
