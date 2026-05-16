import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { qbitLogin } from '@/lib/qbit-api';
import { useAuthStore } from '@/store';

export default function LoginScreen() {
  const [host, setHost] = useState('http://localhost:8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const saveCredentials = useAuthStore((s) => s.saveCredentials);

  async function handleConnect() {
    if (!host.trim() || !username.trim()) {
      Alert.alert('Missing fields', 'Please enter host and username.');
      return;
    }
    setLoading(true);
    try {
      const { sid, host: validHost } = await qbitLogin(host.trim(), username.trim(), password);
      await saveCredentials({ host: validHost, username: username.trim(), sid });
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
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>▶</Text>
        </View>
        <Text style={styles.title}>qbitUI</Text>
        <Text style={styles.subtitle}>Connect to your qBittorrent instance</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Host URL</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.1:8080"
            placeholderTextColor="#555"
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="admin"
            placeholderTextColor="#555"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    color: '#fff',
    fontSize: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: 8,
  },
  label: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
