import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useAuthStore } from '@/store';
import { useThemeStore, type ThemeMode } from '@/store/theme';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: MaterialIconName }[] = [
  { mode: 'light', label: 'Light', icon: 'light-mode' },
  { mode: 'dark', label: 'Dark', icon: 'dark-mode' },
  { mode: 'system', label: 'System', icon: 'phone-android' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
            <ThemePicker />
          </View>
        </View>

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

/** Light / dark / follow-the-system picker. */
function ThemePicker() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View style={styles.themeRow}>
      {THEME_OPTIONS.map((option) => {
        const active = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.themeOption, active && styles.themeOptionActive]}
            onPress={() => setMode(option.mode)}>
            <MaterialIcons
              name={option.icon}
              size={16}
              color={active ? colors.accentText : colors.textSecondary}
            />
            <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowLabel: { color: c.textSecondary, fontSize: 14 },
    rowValue: { color: c.text, fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 16 },
    safeArea: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 24 },
    title: { color: c.text, fontSize: 22, fontWeight: '700' },
    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    themeRow: { flexDirection: 'row', gap: 8, padding: 12 },
    themeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    themeOptionActive: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    themeOptionText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    themeOptionTextActive: { color: c.accentText },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    navLabel: { color: c.text, fontSize: 14 },
    navArrow: { color: c.textSubtle, fontSize: 20 },
    dangerBtn: {
      backgroundColor: c.dangerSoft,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.dangerBorder,
    },
    dangerBtnText: { color: c.dangerText, fontWeight: '700', fontSize: 15 },
  });
