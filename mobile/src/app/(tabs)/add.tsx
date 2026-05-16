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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAddTorrent } from '@/hooks/use-qbit';

export default function AddTorrentScreen() {
  const [magnetText, setMagnetText] = useState('');
  const [savepath, setSavepath] = useState('');
  const [category, setCategory] = useState('');
  const [paused, setPaused] = useState(false);
  const { mutate: addMagnet, isPending } = useAddTorrent();

  function parseMagnets(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('magnet:'));
  }

  function handleAdd() {
    const urls = parseMagnets(magnetText);
    if (urls.length === 0) {
      Alert.alert('Invalid input', 'No valid magnet links found. Each line should start with magnet:');
      return;
    }
    addMagnet(
      { urls, options: { savepath: savepath || undefined, category: category || undefined, paused } },
      {
        onSuccess: () => {
          Alert.alert('Success', `Added ${urls.length} magnet link${urls.length > 1 ? 's' : ''}`);
          setMagnetText('');
          setSavepath('');
          setCategory('');
          setPaused(false);
        },
        onError: (e) => {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add magnet link');
        },
      }
    );
  }

  const magnetCount = parseMagnets(magnetText).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Torrent</Text>
          <Text style={styles.subtitle}>Paste one or more magnet links below</Text>

          <Text style={styles.label}>Magnet Links</Text>
          <TextInput
            style={styles.textarea}
            placeholder="magnet:?xt=urn:btih:..."
            placeholderTextColor="#555"
            value={magnetText}
            onChangeText={setMagnetText}
            multiline
            numberOfLines={6}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>One magnet link per line</Text>

          <Text style={styles.label}>Save Path (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="/downloads"
            placeholderTextColor="#555"
            value={savepath}
            onChangeText={setSavepath}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Category (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="movies"
            placeholderTextColor="#555"
            value={category}
            onChangeText={setCategory}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable style={styles.toggleRow} onPress={() => setPaused((v) => !v)}>
            <View style={[styles.toggle, paused && styles.toggleOn]}>
              <View style={[styles.toggleKnob, paused && styles.toggleKnobOn]} />
            </View>
            <Text style={styles.toggleLabel}>Add as paused</Text>
          </Pressable>

          <Pressable
            style={[styles.button, (isPending || magnetCount === 0) && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={isPending || magnetCount === 0}>
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {magnetCount > 1 ? `Add ${magnetCount} Magnets` : 'Add Magnet'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 20, gap: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#9ca3af', fontSize: 14, marginBottom: 16 },
  label: { color: '#d1d5db', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  textarea: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    height: 120,
    textAlignVertical: 'top',
  },
  hint: { color: '#6b7280', fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#374151',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: '#2563eb' },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  toggleLabel: { color: '#d1d5db', fontSize: 14 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
