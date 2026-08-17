import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTorrents } from '@/hooks/use-qbit';
import { useCategories, useCategoryMutations, useTagMutations, useTags } from '@/hooks/use-taxonomy';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { parseTorrentTags } from '@/lib/utils';
import { useUIStore } from '@/store';

/**
 * Manages the categories and tags qBittorrent knows about.  Assigning them to
 * torrents happens from the torrent action sheet; this screen is about the
 * labels themselves.
 */
export default function LabelsScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CategoriesSection />
        <TagsSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CategoriesSection() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const { data: torrents } = useTorrents();
  const { data: categories } = useCategories();
  const { createCategory, removeCategories } = useCategoryMutations();
  const { categoryFilter, setCategoryFilter } = useUIStore();

  const [name, setName] = useState('');
  const [savePath, setSavePath] = useState('');
  const [editing, setEditing] = useState<{ name: string; savePath: string } | null>(null);

  const entries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const torrent of torrents ?? []) {
      const category = torrent.category ?? '';
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Object.entries(categories ?? {})
      .map(([key, value]) => ({
        name: key,
        savePath: value?.savePath ?? '',
        count: counts.get(key) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, torrents]);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { name: trimmed, savePath: savePath.trim() },
      {
        onSuccess: () => {
          setName('');
          setSavePath('');
        },
        onError: (e) =>
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category'),
      }
    );
  }

  function confirmRemove(category: string) {
    Alert.alert(
      'Remove category',
      `Remove "${category}"? Torrents in it stay, but lose the category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeCategories.mutate([category], {
              onSuccess: () => {
                if (categoryFilter === category) setCategoryFilter(null);
              },
              onError: (e) =>
                Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove category'),
            }),
        },
      ]
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Categories</Text>

      <View style={styles.card}>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.placeholder}
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="Save path (optional)"
            placeholderTextColor={colors.placeholder}
            value={savePath}
            onChangeText={setSavePath}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={add}
          />
          <Pressable
            style={[styles.addBtn, (!name.trim() || createCategory.isPending) && styles.disabled]}
            onPress={add}
            disabled={!name.trim() || createCategory.isPending}>
            {createCategory.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name="add" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No categories yet.</Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.name} style={styles.entryRow}>
              <MaterialIcons name="folder" size={18} color={colors.textSecondary} />
              <View style={styles.entryText}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text style={styles.entryMeta} numberOfLines={1}>
                  {entry.count} torrent{entry.count === 1 ? '' : 's'}
                  {entry.savePath ? ` · ${entry.savePath}` : ''}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.entryAction}
                onPress={() => setEditing({ name: entry.name, savePath: entry.savePath })}>
                <MaterialIcons name="edit" size={18} color={colors.textSecondary} />
              </Pressable>
              <Pressable hitSlop={8} style={styles.entryAction} onPress={() => confirmRemove(entry.name)}>
                <MaterialIcons name="delete" size={18} color={colors.dangerText} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Keyed so each category opens the modal with its own save path. */}
      {editing && (
        <EditCategoryModal key={editing.name} target={editing} onClose={() => setEditing(null)} />
      )}
    </View>
  );
}

/** qBittorrent cannot rename a category, so only the save path is editable. */
function EditCategoryModal({
  target,
  onClose,
}: {
  target: { name: string; savePath: string } | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const { editCategory } = useCategoryMutations();
  const [savePath, setSavePath] = useState(target?.savePath ?? '');

  function save() {
    if (!target) return;
    editCategory.mutate(
      { name: target.name, savePath: savePath.trim() },
      {
        onSuccess: onClose,
        onError: (e) =>
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to edit category'),
      }
    );
  }

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{target?.name}</Text>
          <Text style={styles.modalHint}>Where torrents in this category are saved.</Text>
          <TextInput
            style={styles.input}
            placeholder="/downloads/movies"
            placeholderTextColor={colors.placeholder}
            value={savePath}
            onChangeText={setSavePath}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={save}
          />
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalSave, editCategory.isPending && styles.disabled]}
              onPress={save}
              disabled={editCategory.isPending}>
              <Text style={styles.modalSaveText}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TagsSection() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const { data: torrents } = useTorrents();
  const { data: tags } = useTags();
  const { createTags, deleteTags } = useTagMutations();
  const { tagFilter, setTagFilter } = useUIStore();
  const [draft, setDraft] = useState('');

  const entries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const torrent of torrents ?? []) {
      for (const tag of parseTorrentTags(torrent.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...new Set([...(tags ?? []), ...counts.keys()])]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ tag, count: counts.get(tag) ?? 0 }));
  }, [tags, torrents]);

  function add() {
    // Tag names travel comma-separated, so a comma always starts a new tag.
    const wanted = draft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (wanted.length === 0) return;
    createTags.mutate(wanted, {
      onSuccess: () => setDraft(''),
      onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create tag'),
    });
  }

  function confirmDelete(tag: string) {
    Alert.alert('Delete tag', `Delete "${tag}"? Torrents carrying it stay, but lose the tag.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteTags.mutate([tag], {
            onSuccess: () => {
              if (tagFilter === tag) setTagFilter(null);
            },
            onError: (e) =>
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete tag'),
          }),
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tags</Text>

      <View style={styles.card}>
        <View style={styles.formRow}>
          <TextInput
            style={styles.input}
            placeholder="New tag — separate several with commas"
            placeholderTextColor={colors.placeholder}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={add}
          />
          <Pressable
            style={[styles.addBtn, (!draft.trim() || createTags.isPending) && styles.disabled]}
            onPress={add}
            disabled={!draft.trim() || createTags.isPending}>
            {createTags.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialIcons name="add" size={20} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No tags yet.</Text>
        ) : (
          entries.map(({ tag, count }) => (
            <View key={tag} style={styles.entryRow}>
              <MaterialIcons name="label" size={18} color={colors.textSecondary} />
              <View style={styles.entryText}>
                <Text style={styles.entryName} numberOfLines={1}>
                  {tag}
                </Text>
                <Text style={styles.entryMeta}>
                  {count} torrent{count === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable hitSlop={8} style={styles.entryAction} onPress={() => confirmDelete(tag)}>
                <MaterialIcons name="delete" size={18} color={colors.dangerText} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, gap: 24 },
    section: { gap: 8 },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    formRow: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, paddingBottom: 0 },
    input: {
      flex: 1,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
      marginBottom: 10,
    },
    addBtn: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: c.accentStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    disabled: { opacity: 0.5 },
    empty: { color: c.textSubtle, fontSize: 14, padding: 16 },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    entryText: { flex: 1, gap: 2 },
    entryName: { color: c.text, fontSize: 15, fontWeight: '600' },
    entryMeta: { color: c.textSubtle, fontSize: 12 },
    entryAction: { padding: 4 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      backgroundColor: c.chrome,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      gap: 6,
    },
    modalTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    modalHint: { color: c.textSubtle, fontSize: 13, marginBottom: 8 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    modalCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    modalCancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    modalSave: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.accentStrong,
    },
    modalSaveText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  });
