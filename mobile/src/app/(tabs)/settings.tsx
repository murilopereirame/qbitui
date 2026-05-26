import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store';

export default function SettingsScreen() {
  const router = useRouter();
  const { credentials, clearCredentials } = useAuthStore();

  function handleDisconnect() {
    Alert.alert(
      'Disconnect',
      'Remove saved credentials and go back to the login screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => clearCredentials(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {credentials && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection</Text>
            <View style={styles.card}>
              <Row label="Host" value={credentials.host} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
          <View style={styles.card}>
            <Pressable style={styles.navRow} onPress={() => router.push('/logs')}>
              <Text style={styles.navLabel}>View App Logs</Text>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable style={styles.dangerBtn} onPress={handleDisconnect}>
            <Text style={styles.dangerBtnText}>Disconnect</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  label: { color: '#9ca3af', fontSize: 14 },
  value: { color: '#fff', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 16 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 20, gap: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  navLabel: { color: '#e2e8f0', fontSize: 14 },
  navArrow: { color: '#6b7280', fontSize: 20 },
  dangerBtn: {
    backgroundColor: '#450a0a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  dangerBtnText: { color: '#fca5a5', fontWeight: '700', fontSize: 15 },
});
