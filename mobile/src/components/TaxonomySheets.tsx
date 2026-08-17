import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTorrents } from '@/hooks/use-qbit';
import { useCategories, useTagMutations, useTags, useTorrentTaxonomy } from '@/hooks/use-taxonomy';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { TaxonomyFilter } from '@/lib/types';
import { parseTorrentTags } from '@/lib/utils';
import { useUIStore } from '@/store';

/** A bottom sheet shell shared by every taxonomy picker. */
function Sheet({
  visible,
  onClose,
  title,
  action,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Optional control shown on the right of the title row. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Stop propagation so taps inside the sheet don't dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {action}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {children}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  label,
  icon,
  count,
  selected,
  onPress,
  muted,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  count?: number;
  selected?: boolean;
  onPress: () => void;
  muted?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();

  return (
    <Pressable style={[styles.row, selected && styles.rowSelected]} onPress={onPress}>
      <MaterialIcons
        name={icon}
        size={18}
        color={selected ? colors.accentText : muted ? colors.textSubtle : colors.textSecondary}
      />
      <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined && <Text style={styles.rowCount}>{count}</Text>}
      {selected && <MaterialIcons name="check" size={18} color={colors.accentText} />}
    </Pressable>
  );
}

/** Category and tag counts over the whole torrent list. */
function useTaxonomyCounts() {
  const { data: torrents } = useTorrents();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

  return useMemo(() => {
    const all = torrents ?? [];
    const categoryCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let uncategorized = 0;
    let untagged = 0;

    for (const torrent of all) {
      const category = torrent.category ?? '';
      if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      else uncategorized += 1;

      const torrentTags = parseTorrentTags(torrent.tags);
      if (torrentTags.length === 0) untagged += 1;
      for (const tag of torrentTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    // Entries that exist in qBittorrent but hold nothing still belong in the list.
    for (const name of Object.keys(categories ?? {})) {
      if (!categoryCounts.has(name)) categoryCounts.set(name, 0);
    }
    for (const tag of tags ?? []) {
      if (!tagCounts.has(tag)) tagCounts.set(tag, 0);
    }

    const sorted = (counts: Map<string, number>) =>
      [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));

    return {
      total: all.length,
      uncategorized,
      untagged,
      categories: sorted(categoryCounts),
      tags: sorted(tagCounts),
    };
  }, [torrents, categories, tags]);
}

/** Picks which category and tag the torrent list is filtered by. */
export function TaxonomyFilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const { categoryFilter, setCategoryFilter, tagFilter, setTagFilter } = useUIStore();
  const counts = useTaxonomyCounts();

  function choose(setter: (value: TaxonomyFilter) => void, value: TaxonomyFilter) {
    setter(value);
    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filter"
      action={
        <Pressable
          style={styles.headerAction}
          onPress={() => {
            onClose();
            router.push('/labels');
          }}>
          <MaterialIcons name="settings" size={16} color={colors.accentText} />
          <Text style={styles.headerActionText}>Manage</Text>
        </Pressable>
      }>
      <Text style={styles.sectionLabel}>Categories</Text>
      <Row
        label="All categories"
        icon="folder-open"
        count={counts.total}
        selected={categoryFilter === null}
        onPress={() => choose(setCategoryFilter, null)}
      />
      <Row
        label="Uncategorized"
        icon="folder-off"
        count={counts.uncategorized}
        muted
        selected={categoryFilter === ''}
        onPress={() => choose(setCategoryFilter, '')}
      />
      {counts.categories.map(([name, count]) => (
        <Row
          key={name}
          label={name}
          icon="folder"
          count={count}
          selected={categoryFilter === name}
          onPress={() => choose(setCategoryFilter, name)}
        />
      ))}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Tags</Text>
      <Row
        label="All tags"
        icon="sell"
        count={counts.total}
        selected={tagFilter === null}
        onPress={() => choose(setTagFilter, null)}
      />
      <Row
        label="Untagged"
        icon="label-off"
        count={counts.untagged}
        muted
        selected={tagFilter === ''}
        onPress={() => choose(setTagFilter, '')}
      />
      {counts.tags.map(([tag, count]) => (
        <Row
          key={tag}
          label={tag}
          icon="label"
          count={count}
          selected={tagFilter === tag}
          onPress={() => choose(setTagFilter, tag)}
        />
      ))}
    </Sheet>
  );
}

/** Moves torrents into a category, or clears the one they are in. */
export function CategoryPickerSheet({
  visible,
  hashes,
  current,
  onClose,
}: {
  visible: boolean;
  hashes: string[];
  /** The category the torrents are in, or '' when they have none. */
  current: string;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { data: categories } = useCategories();
  const { setCategory } = useTorrentTaxonomy();

  const names = useMemo(
    () =>
      [...new Set([...Object.keys(categories ?? {}), ...(current ? [current] : [])])].sort((a, b) =>
        a.localeCompare(b)
      ),
    [categories, current]
  );

  function assign(category: string) {
    setCategory.mutate(
      { hashes, category },
      { onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to set category') }
    );
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Category">
      <Row label="No category" icon="folder-off" muted selected={current === ''} onPress={() => assign('')} />
      {names.map((name) => (
        <Row
          key={name}
          label={name}
          icon="folder"
          selected={current === name}
          onPress={() => assign(name)}
        />
      ))}
      <Text style={styles.emptyHint}>Create categories from Filter → Manage.</Text>
    </Sheet>
  );
}

/** Toggles tags on torrents; the sheet stays open so several can be set at once. */
export function TagPickerSheet({
  visible,
  hashes,
  current,
  onClose,
}: {
  visible: boolean;
  hashes: string[];
  /** Tags the torrents already carry. */
  current: string[];
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const { data: knownTags } = useTags();
  const { createTags } = useTagMutations();
  const { addTags, removeTags } = useTorrentTaxonomy();
  const [draft, setDraft] = useState('');

  const names = useMemo(
    () => [...new Set([...(knownTags ?? []), ...current])].sort((a, b) => a.localeCompare(b)),
    [knownTags, current]
  );

  function toggle(tag: string) {
    const remove = current.includes(tag);
    const mutation = remove ? removeTags : addTags;
    mutation.mutate(
      { hashes, tags: [tag] },
      { onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update tags') }
    );
  }

  function addNew() {
    // Tag names travel comma-separated, so a comma always starts a new tag.
    const tags = draft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    createTags.mutate(tags, {
      onSuccess: () => {
        setDraft('');
        addTags.mutate(
          { hashes, tags },
          { onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add tags') }
        );
      },
      onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create tag'),
    });
  }

  const busy = createTags.isPending || addTags.isPending;

  return (
    <Sheet visible={visible} onClose={onClose} title="Tags">
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="New tag…"
          placeholderTextColor={colors.placeholder}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={addNew}
        />
        <Pressable
          style={[styles.inputBtn, (!draft.trim() || busy) && styles.inputBtnDisabled]}
          onPress={addNew}
          disabled={!draft.trim() || busy}>
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <MaterialIcons name="add" size={18} color="#ffffff" />
          )}
        </Pressable>
      </View>

      {names.length === 0 ? (
        <Text style={styles.emptyHint}>No tags yet — add one above.</Text>
      ) : (
        names.map((tag) => (
          <Row
            key={tag}
            label={tag}
            icon="label"
            selected={current.includes(tag)}
            onPress={() => toggle(tag)}
          />
        ))
      )}
    </Sheet>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.chrome,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 20,
      borderTopWidth: 1,
      borderColor: c.border,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      marginBottom: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sheetTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentBorder,
    },
    headerActionText: { color: c.accentText, fontSize: 13, fontWeight: '600' },
    scroll: { flexGrow: 0 },
    scrollContent: { paddingBottom: 8 },
    sectionLabel: {
      color: c.textSubtle,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    rowSelected: { backgroundColor: c.accentSoft },
    rowLabel: { color: c.text, fontSize: 15, flex: 1 },
    rowLabelSelected: { color: c.accentText, fontWeight: '600' },
    rowCount: { color: c.textSubtle, fontSize: 12 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 10 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
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
    },
    inputBtn: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: c.accentStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputBtnDisabled: { opacity: 0.5 },
    emptyHint: { color: c.textSubtle, fontSize: 13, paddingVertical: 12, paddingHorizontal: 10 },
    closeBtn: {
      marginTop: 8,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    closeText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  });
