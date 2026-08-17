import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useRef, useState } from 'react';
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

import { TorrentContentPicker } from '@/components/TorrentContentPicker';
import type { ThemeColors } from '@/constants/theme';
import { useAddTorrent } from '@/hooks/use-qbit';
import { useCategories, useTags } from '@/hooks/use-taxonomy';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useTorrentPrefetch, type TorrentContents } from '@/hooks/use-torrent-prefetch';

type AddMode = 'magnet' | 'file';

export default function AddTorrentScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const [mode, setMode] = useState<AddMode>('magnet');
  const [magnetText, setMagnetText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const [savepath, setSavepath] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [paused, setPaused] = useState(false);
  const [contents, setContents] = useState<TorrentContents | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const { mutate: addTorrent, isPending } = useAddTorrent();
  const { readContents, confirmStaged, confirmMagnet, discard, metadataApiUrl } =
    useTorrentPrefetch();
  const { data: categories } = useCategories();
  const { data: knownTags } = useTags();

  // A staged .torrent sits stopped inside qBittorrent; make sure it never
  // outlives the screen without the user having confirmed it.
  const stagedRef = useRef<string | null>(null);
  useEffect(() => {
    stagedRef.current = contents?.stagedHash ?? null;
  }, [contents]);
  useEffect(() => {
    return () => {
      const pending = stagedRef.current;
      if (pending) void discard(pending);
    };
    // discard is recreated every render; the cleanup only needs to run on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseMagnets(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('magnet:'));
  }

  function resetForm() {
    setMagnetText('');
    setSelectedFile(null);
    setSavepath('');
    setCategory('');
    setTags('');
    setPaused(false);
    setContents(null);
    setSelectedIndexes(new Set());
  }

  function dropContents() {
    if (!contents) return;
    if (contents.stagedHash) void discard(contents.stagedHash);
    setContents(null);
    setSelectedIndexes(new Set());
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
      dropContents();
      setSelectedFile({ uri: asset.uri, name: asset.name });
    } catch {
      Alert.alert('Error', 'Failed to pick file');
    }
  }

  /** Reads the torrent's file list before anything is queued. */
  function handleFetchContents() {
    if (contents) return;
    const magnets = parseMagnets(magnetText);

    if (mode === 'magnet' && magnets.length === 0) {
      Alert.alert('Invalid input', 'No valid magnet links found. Each line should start with magnet:');
      return;
    }
    if (mode === 'magnet' && magnets.length > 1) {
      Alert.alert(
        'One at a time',
        'Choosing files works on a single torrent. Keep one magnet link to pick its files, or add them all without choosing.'
      );
      return;
    }
    if (mode === 'file' && !selectedFile) {
      Alert.alert('No file selected', 'Please pick a .torrent file first');
      return;
    }

    readContents.mutate(
      mode === 'magnet'
        ? { type: 'magnet', url: magnets[0] }
        : { type: 'file', fileUri: selectedFile!.uri, fileName: selectedFile!.name },
      {
        onSuccess: (result) => {
          setContents(result);
          setSelectedIndexes(new Set(result.files.map((file) => file.index)));
        },
        onError: (e) => Alert.alert('Error', e.message),
      }
    );
  }

  /** The tag names currently typed into the comma-separated tags field. */
  function parseTags(text: string): string[] {
    return text
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  /** Adds or removes a tag from the comma-separated tags field. */
  function toggleTag(tag: string) {
    const current = parseTags(tags);
    const next = current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag];
    setTags(next.join(', '));
  }

  function handleAdd() {
    const chosenTags = parseTags(tags);
    const options = {
      savepath: savepath || undefined,
      category: category || undefined,
      tags: chosenTags.length > 0 ? chosenTags.join(',') : undefined,
      paused,
    };

    // Contents were listed: apply the file selection.
    if (contents) {
      if (selectedIndexes.size === 0) {
        Alert.alert('Nothing selected', 'Select at least one file to download.');
        return;
      }
      const skipped = contents.files.filter((file) => !selectedIndexes.has(file.index));
      const done = (warning?: string | null) => {
        Alert.alert(
          'Success',
          skipped.length > 0
            ? `Added ${contents.name} — skipping ${skipped.length} file${skipped.length > 1 ? 's' : ''}`
            : `Added ${contents.name}`
        );
        if (warning) Alert.alert('Heads up', warning);
        resetForm();
      };

      if (contents.stagedHash) {
        confirmStaged.mutate(
          {
            hash: contents.stagedHash,
            excludedIndexes: skipped.map((file) => file.index),
            options,
          },
          { onSuccess: () => done(), onError: (e) => Alert.alert('Error', e.message) }
        );
      } else {
        confirmMagnet.mutate(
          {
            url: parseMagnets(magnetText)[0],
            excludedPaths: skipped.map((file) => file.name),
            options,
          },
          { onSuccess: (warning) => done(warning), onError: (e) => Alert.alert('Error', e.message) }
        );
      }
      return;
    }

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
            resetForm();
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
            resetForm();
          },
          onError: (e) => {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add torrent file');
          },
        }
      );
    }
  }

  const magnetCount = parseMagnets(magnetText).length;
  const categoryNames = Object.keys(categories ?? {}).sort((a, b) => a.localeCompare(b));
  const selectedTags = parseTags(tags);
  const hasInput = mode === 'magnet' ? magnetCount > 0 : selectedFile !== null;
  const busy =
    isPending || readContents.isPending || confirmStaged.isPending || confirmMagnet.isPending;
  const canAdd = hasInput && !busy;
  // Magnet contents come from the metadata API, so that button only shows when
  // one is configured; .torrent files are read through qBittorrent itself.
  const canChooseFiles = mode === 'file' || Boolean(metadataApiUrl);

  function addButtonLabel() {
    if (contents) return `Add ${selectedIndexes.size} of ${contents.files.length} files`;
    if (mode === 'magnet') return magnetCount > 1 ? `Add ${magnetCount} Magnets` : 'Add Magnet';
    return 'Add Torrent';
  }

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
                color={mode === 'magnet' ? colors.accentText : colors.textSecondary}
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
                color={mode === 'file' ? colors.accentText : colors.textSecondary}
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
                placeholderTextColor={colors.placeholder}
                value={magnetText}
                onChangeText={(text) => {
                  dropContents();
                  setMagnetText(text);
                }}
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
                <MaterialIcons name="folder-open" size={24} color={colors.textSecondary} />
                <Text style={styles.filePickerText} numberOfLines={1}>
                  {selectedFile ? selectedFile.name : 'Tap to browse…'}
                </Text>
              </Pressable>
            </>
          )}

          {/* Contents */}
          {contents ? (
            <>
              <View style={styles.contentsHeader}>
                <Text style={styles.label}>Contents</Text>
                <Pressable onPress={dropContents} hitSlop={8}>
                  <Text style={styles.clearLink}>Clear</Text>
                </Pressable>
              </View>
              <TorrentContentPicker
                name={contents.name}
                files={contents.files}
                totalSize={contents.totalSize}
                selected={selectedIndexes}
                onChange={setSelectedIndexes}
              />
              <Text style={styles.hint}>
                Deselected files are skipped — qBittorrent will not download them.
              </Text>
            </>
          ) : canChooseFiles ? (
            <Pressable
              style={[styles.secondaryBtn, (!hasInput || busy) && styles.buttonDisabled]}
              onPress={handleFetchContents}
              disabled={!hasInput || busy}>
              {readContents.isPending ? (
                <ActivityIndicator color={colors.accentText} size="small" />
              ) : (
                <MaterialIcons name="account-tree" size={16} color={colors.accentText} />
              )}
              <Text style={styles.secondaryBtnText}>
                {readContents.isPending ? 'Looking up files…' : 'Choose files first'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.hint}>
              Set a metadata API in Settings to list a magnet link&apos;s files before adding it.
            </Text>
          )}

          <Text style={styles.label}>Save Path (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="/downloads"
            placeholderTextColor={colors.placeholder}
            value={savepath}
            onChangeText={setSavepath}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Category (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="movies"
            placeholderTextColor={colors.placeholder}
            value={category}
            onChangeText={setCategory}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {categoryNames.length > 0 && (
            <View style={styles.chipRow}>
              {categoryNames.map((name) => {
                const active = category === name;
                return (
                  <Pressable
                    key={name}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(active ? '' : name)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Tags (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="tag1, tag2"
            placeholderTextColor={colors.placeholder}
            value={tags}
            onChangeText={setTags}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {(knownTags?.length ?? 0) > 0 && (
            <View style={styles.chipRow}>
              {knownTags?.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleTag(tag)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable style={styles.toggleRow} onPress={() => setPaused((v) => !v)}>
            <View style={[styles.toggle, paused && styles.toggleOn]}>
              <View style={[styles.toggleKnob, paused && styles.toggleKnobOn]} />
            </View>
            <Text style={styles.toggleLabel}>Add as paused</Text>
          </Pressable>

          <Pressable
            style={[styles.button, !canAdd && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={!canAdd}>
            {busy && !readContents.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>{addButtonLabel()}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 8 },
    title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
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
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    modeBtnActive: {
      backgroundColor: c.accentSoft,
      borderColor: c.accentBorder,
    },
    modeBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    modeBtnTextActive: { color: c.accentText },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 8 },
    contentsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    clearLink: { color: c.accentText, fontSize: 13, fontWeight: '600', marginTop: 8 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
    },
    textarea: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      height: 120,
      textAlignVertical: 'top',
    },
    filePicker: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    filePickerText: { color: c.textSecondary, fontSize: 14, flex: 1 },
    hint: { color: c.textSubtle, fontSize: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    chipActive: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    chipText: { color: c.textSecondary, fontSize: 13 },
    chipTextActive: { color: c.accentText, fontWeight: '600' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentBorder,
    },
    secondaryBtnText: { color: c.accentText, fontSize: 14, fontWeight: '600' },
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
      backgroundColor: c.borderStrong,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleOn: { backgroundColor: c.accentStrong },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#ffffff',
    },
    toggleKnobOn: { alignSelf: 'flex-end' },
    toggleLabel: { color: c.text, fontSize: 14 },
    button: {
      backgroundColor: c.accentStrong,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  });
