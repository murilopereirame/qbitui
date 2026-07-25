import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import appIcon from '@/assets/images/icon.png';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { verifyApiToken } from '@/lib/qbit-api';
import { useAuthStore } from '@/store';

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const [host, setHost] = useState('http://localhost:8080');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const saveCredentials = useAuthStore((s) => s.saveCredentials);

  async function handleConnect() {
    if (!host.trim() || !apiToken.trim()) {
      Alert.alert('Missing fields', 'Please enter the host URL and API token.');
      return;
    }
    setLoading(true);
    try {
      const resolvedHost = await verifyApiToken(host.trim(), apiToken.trim());
      await saveCredentials({ host: resolvedHost, apiToken: apiToken.trim() });
    } catch (e) {
      Alert.alert('Connection failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <Image source={appIcon} alt="" style={styles.icon} accessibilityIgnoresInvertColors />
        <Text style={styles.title}>qbitUI</Text>
        <Text style={styles.subtitle}>Connect to your qBittorrent instance</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Host URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.1:8080"
            placeholderTextColor={colors.placeholder}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>API Token</Text>
          <TextInput
            style={styles.input}
            placeholder="qbt_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor={colors.placeholder}
            value={apiToken}
            onChangeText={setApiToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            Find your API token in qBittorrent → Settings → Web UI → API Key
          </Text>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: ThemeColors) =>
StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 14,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 32,
    },
    form: {
      width: '100%',
      maxWidth: 400,
      gap: 8,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 8,
    },
    hint: {
      color: c.textSubtle,
      fontSize: 12,
      marginTop: 2,
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 15,
    },
    button: {
      backgroundColor: c.accentStrong,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#ffffff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
