import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from '../screens/LoginScreen';
import { TorrentListScreen } from '../screens/TorrentListScreen';
import { TorrentDetailScreen } from '../screens/TorrentDetailScreen';
import { useAuthStore } from '../store/authStore';

export type RootStackParamList = {
  Login: undefined;
  TorrentList: undefined;
  TorrentDetail: { hash: string; name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App() {
  const isAuthenticated = useAuthStore((s) => !!s.sid);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#030712' },
            headerTintColor: '#fff',
            contentStyle: { backgroundColor: '#030712' },
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen name="TorrentList" component={TorrentListScreen} options={{ title: 'qbitUI' }} />
              <Stack.Screen name="TorrentDetail" component={TorrentDetailScreen} options={({ route }) => ({ title: route.params.name })} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
