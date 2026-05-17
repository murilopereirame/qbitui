import * as DocumentPicker from 'expo-document-picker';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useAddTorrent } from '@/hooks/use-qbit';

type AddMode = 'magnet' | 'file';

export default function AddTorrentScreen() {
  const [mode, setMode] = useState<AddMode>('magnet');
  const [magnetText, setMagnetText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const [savepath, setSavepath] = useState('');
  const [category, setCategory] = useState('');
  const [paused, setPaused] = useState(false);
  const { mutate: addTorrent, isPending } = useAddTorrent();

  function parseMagnets(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('magnet:'));
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-bittorrent', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const isTorrentFile = asset.name.toLowerCase().endsWith('.torrent');
      if (!isTorrentFile) {
        Alert.alert('Invalid file', 'Please select a .torrent file');
        return;
      }
      setSelectedFile({ uri: asset.uri, name: asset.name });
    } catch {
      Alert.alert('Error', 'Failed to pick file');
    }
  }

  function handleAdd() {
    const options = { savepath: savepath || undefined, category: category || undefined, paused };

    if (mode === 'magnet') {
      const urls = parseMagnets(magnetText);
      if (urls.length === 0) {
        Alert.alert('Invalid input', 'No valid magnet links found. Each line should start with magnet:');
        return;
      }
      addTorrent(
        { type: 'magnet', urls, options },
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
    } else {
      if (!selectedFile) {
        Alert.alert('No file selected', 'Please pick a .torrent file first');
        return;
      }
      addTorrent(
        { type: 'file', fileUri: selectedFile.uri, fileName: selectedFile.name, options },
        {
          onSuccess: () => {
            Alert.alert('Success', `Added ${selectedFile.name}`);
            setSelectedFile(null);
            setSavepath('');
            setCategory('');
            setPaused(false);
          },
          onError: (e) => {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add torrent file');
          },
        }
      );
    }
  }

  const magnetCount = parseMagnets(magnetText).length;
  const canAdd = mode === 'magnet' ? magnetCount > 0 : selectedFile !== null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add Torrent</Text>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeBtn, mode === 'magnet' && styles.modeBtnActive]}
              onPress={() => setMode('magnet')}>
              <MaterialIcons
                name="link"
                size={16}
                color={mode === 'magnet' ? '#93c5fd' : '#9ca3af'}
              />
              <Text style={[styles.modeBtnText, mode === 'magnet' && styles.modeBtnTextActive]}>
                Magnet Link
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'file' && styles.modeBtnActive]}
              onPress={() => setMode('file')}>
              <MaterialIcons
                name="upload-file"
                size={16}
                color={mode === 'file' ? '#93c5fd' : '#9ca3af'}
              />
              <Text style={[styles.modeBtnText, mode === 'file' && styles.modeBtnTextActive]}>
                Torrent File
              </Text>
            </Pressable>
          </View>

          {mode === 'magnet' ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={styles.label}>Torrent File</Text>
              <Pressable style={styles.filePicker} onPress={handlePickFile}>
                <MaterialIcons name="folder-open" size={24} color="#9ca3af" />
                <Text style={styles.filePickerText} numberOfLines={1}>
                  {selectedFile ? selectedFile.name : 'Tap to browse…'}
                </Text>
              </Pressable>
            </>
          )}

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
            style={[styles.button, (!canAdd || isPending) && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={isPending || !canAdd}>
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'magnet'
                  ? magnetCount > 1
                    ? `Add ${magnetCount} Magnets`
                    : 'Add Magnet'
                  : 'Add Torrent'}
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
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modeBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  modeBtnText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#93c5fd' },
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
  filePicker: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filePickerText: { color: '#9ca3af', fontSize: 14, flex: 1 },
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
