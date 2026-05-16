import { Tabs } from 'expo-router';
import React from 'react';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#030712',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Torrents',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="↓" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="+" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="⚙" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ color, fontSize: 18, fontWeight: '600' }}>{symbol}</Text>;
}
