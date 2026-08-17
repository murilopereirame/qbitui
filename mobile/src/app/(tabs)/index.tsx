import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { CategoryPickerSheet, TagPickerSheet, TaxonomyFilterSheet } from '@/components/TaxonomySheets';
import { TorrentActionSheet } from '@/components/TorrentActionSheet';
import { stateColor, type ThemeColors } from '@/constants/theme';
import { useTorrentAction, useTorrents, useTransfer } from '@/hooks/use-qbit';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { Torrent, TorrentAction, TorrentFilter } from '@/lib/types';
import { formatBytes, formatETA, formatRatio, formatSpeed, getStateColor, getStateLabel, parseTorrentTags, toPercent } from '@/lib/utils';
import { SortField, useUIStore } from '@/store';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];
type SELECTION_ACTION = Exclude<TorrentAction, 'recheck' | 'reannounce'>;

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'added_on', label: 'Date Added' },
  { field: 'name', label: 'Name' },
  { field: 'size', label: 'Size' },
  { field: 'progress', label: 'Progress' },
  { field: 'dlspeed', label: 'DL Speed' },
  { field: 'upspeed', label: 'UL Speed' },
  { field: 'ratio', label: 'Ratio' },
  { field: 'eta', label: 'ETA' },
];

const SELECTION_ACTIONS: {
  action: SELECTION_ACTION;
  label: string;
  icon: MaterialIconName;
  danger?: boolean;
}[] = [
    { action: 'resume', label: 'Resume', icon: 'play-arrow' },
    { action: 'pause', label: 'Pause', icon: 'pause' },
    { action: 'topPrio', label: 'Top', icon: 'vertical-align-top' },
    { action: 'increasePrio', label: 'Up', icon: 'arrow-upward' },
    { action: 'decreasePrio', label: 'Down', icon: 'arrow-downward' },
    { action: 'bottomPrio', label: 'Bottom', icon: 'vertical-align-bottom' },
    { action: 'delete', label: 'Delete', icon: 'delete', danger: true },
  ];

const FILTERS: { key: TorrentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'downloading', label: 'Downloading' },
  { key: 'seeding', label: 'Seeding' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
  { key: 'error', label: 'Error' },
];

export default function TorrentsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    filter,
    setFilter,
    search,
    setSearch,
    selectionMode,
    selectedHashes,
    enterSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    sortField,
    sortDir,
    toggleSort,
    categoryFilter,
    setCategoryFilter,
    tagFilter,
    setTagFilter,
  } = useUIStore();
  const { data: allTorrents, filteredTorrents, isLoading, isError, refetch, isFetching } = useTorrents();
  const { data: transfer } = useTransfer();
  const { mutate: doAction } = useTorrentAction();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ hash: string; name: string } | null>(null);
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<Torrent | null>(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectionPicker, setSelectionPicker] = useState<'category' | 'tags' | null>(null);

  const allSelected =
    filteredTorrents.length > 0 && filteredTorrents.every((t) => selectedHashes.has(t.hash));
  const hasTaxonomyFilter = categoryFilter !== null || tagFilter !== null;

  const selectedTorrents = (allTorrents ?? []).filter((t) => selectedHashes.has(t.hash));
  // The pickers tick what the whole selection shares, so a tap applies to all of it.
  const sharedCategory = selectedTorrents.every(
    (t) => (t.category ?? '') === (selectedTorrents[0]?.category ?? '')
  )
    ? selectedTorrents[0]?.category ?? ''
    : '';
  const sharedTags = selectedTorrents.length
    ? parseTorrentTags(selectedTorrents[0].tags).filter((tag) =>
        selectedTorrents.every((t) => parseTorrentTags(t.tags).includes(tag))
      )
    : [];

  function triggerSelectionExit() {
    clearSelection();
  }

  // Android hardware back exits selection mode instead of leaving the screen.
  useEffect(() => {
    if (!selectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      triggerSelectionExit();
      return true;
    });
    return () => sub.remove();
  }, [selectionMode, clearSelection]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function confirmDelete(hash: string, name: string) {
    setDeleteTarget({ hash, name });
  }

  function toggleSelectAll() {
    if (allSelected) selectAll([]);
    else selectAll(filteredTorrents.map((t) => t.hash));
  }

  function bulkAction(action: SELECTION_ACTION) {
    const hashes = Array.from(selectedHashes);
    if (hashes.length === 0) return;
    if (action === 'delete') {
      setBulkDeleteVisible(true);
      return;
    }
    doAction(
      { action, hashes },
      {
        onSuccess: () => triggerSelectionExit(),
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Action failed'),
      }
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header / Selection bar */}
      <Animated.View layout={LinearTransition.duration(230)}>

        {selectionMode ? (<>
          <View style={styles.selectionBar}>
            <Pressable onPress={triggerSelectionExit} hitSlop={8} style={styles.selBarIconBtn}>
              <MaterialIcons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.selBarCount}>{selectedHashes.size} selected</Text>
            <Pressable onPress={toggleSelectAll} hitSlop={8} style={styles.selBarIconBtn}>
              <MaterialIcons name={allSelected ? 'done-all' : 'select-all'} size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.selActionsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selActionsRow}>
              {SELECTION_ACTIONS.map(({ action, label, icon, danger }) => {
                const disabled = selectedHashes.size === 0;
                return (
                  <Pressable
                    key={action}
                    style={[
                      styles.selActionBtn,
                      danger && styles.selActionBtnDanger,
                      disabled && styles.selActionBtnDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => bulkAction(action)}>
                    <MaterialIcons name={icon} size={18} color={danger ? colors.dangerText : colors.text} />
                    <Text style={[styles.selActionText, danger && styles.selActionTextDanger]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              {(['category', 'tags'] as const).map((kind) => {
                const disabled = selectedHashes.size === 0;
                return (
                  <Pressable
                    key={kind}
                    style={[styles.selActionBtn, disabled && styles.selActionBtnDisabled]}
                    disabled={disabled}
                    onPress={() => setSelectionPicker(kind)}>
                    <MaterialIcons
                      name={kind === 'category' ? 'folder' : 'label'}
                      size={18}
                      color={colors.text}
                    />
                    <Text style={styles.selActionText}>
                      {kind === 'category' ? 'Category' : 'Tags'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
        ) : (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>qbitUI</Text>
            {isError ? (
              <View style={styles.disconnected}>
                <MaterialIcons name="wifi-off" size={14} color={colors.danger} />
                <Text style={styles.disconnectedText}>Disconnected</Text>
                <Pressable onPress={() => refetch()} style={styles.reconnectBtn} hitSlop={8}>
                  <MaterialIcons name="refresh" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.speeds}>
                <Text style={styles.speedDl}>↓ {transfer ? formatSpeed(transfer.dl_info_speed) : '—'}</Text>
                <Text style={styles.speedUl}>↑ {transfer ? formatSpeed(transfer.up_info_speed) : '—'}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      <Animated.View layout={LinearTransition.duration(230)} style={{ flex: 1 }}>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search torrents…"
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterWrap}>
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            style={styles.filterScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {FILTERS.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={[styles.filterChip, filter === key && styles.filterChipActive]}>
                <Text style={[styles.filterLabel, filter === key && styles.filterLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setFilterSheetVisible(true)}
            style={[styles.labelsBtn, hasTaxonomyFilter && styles.labelsBtnActive]}
            hitSlop={6}
            accessibilityLabel="Filter by category or tag">
            <MaterialIcons
              name="filter-list"
              size={18}
              color={hasTaxonomyFilter ? colors.accentText : colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Active category / tag filters */}
      {hasTaxonomyFilter && (
        <View style={styles.activeFilterRow}>
          {categoryFilter !== null && (
            <ActiveFilterChip
              icon="folder"
              label={categoryFilter || 'Uncategorized'}
              onClear={() => setCategoryFilter(null)}
            />
          )}
          {tagFilter !== null && (
            <ActiveFilterChip
              icon="label"
              label={tagFilter || 'Untagged'}
              onClear={() => setTagFilter(null)}
            />
          )}
        </View>
      )}

      {/* Count + Sort */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredTorrents.length} torrent{filteredTorrents.length !== 1 ? 's' : ''}
        </Text>
        {isFetching && !refreshing && <ActivityIndicator size="small" color={colors.accent} />}
        <Pressable onPress={() => setSortModalVisible(true)} style={styles.sortBtn} hitSlop={8}>
          <MaterialIcons name="sort" size={16} color={colors.textSubtle} />
          <Text style={styles.sortBtnText}>
            {SORT_OPTIONS.find((o) => o.field === sortField)?.label ?? 'Sort'}
          </Text>
          <MaterialIcons
            name={sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward'}
            size={12}
            color={colors.textSubtle}
          />
        </Pressable>
      </View>

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalVisible(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Sort by</Text>
            {SORT_OPTIONS.map(({ field, label }) => {
              const active = sortField === field;
              return (
                <Pressable
                  key={field}
                  style={[styles.sortOption, active && styles.sortOptionActive]}
                  onPress={() => {
                    toggleSort(field);
                    setSortModalVisible(false);
                  }}>
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                    {label}
                  </Text>
                  {active && (
                    <MaterialIcons
                      name={sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                      size={16}
                      color={colors.accent}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* List */}
      {isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load torrents</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredTorrents}
          keyExtractor={(t) => t.hash}
          extraData={selectedHashes}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={filteredTorrents.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No torrents found</Text>
            </View>
          }
          renderItem={({ item: t }) => {
            const badgeColor = stateColor(colors, getStateColor(t.state));
            const isSelected = selectedHashes.has(t.hash);

            return (
              <Pressable
                style={[styles.torrentRow, isSelected && styles.torrentRowSelected]}
                onPress={() => {
                  if (selectionMode) toggleSelection(t.hash);
                  else router.push(`/torrent/${t.hash}`);
                }}
                onLongPress={() => {
                  if (selectionMode) toggleSelection(t.hash);
                  else setSheetTarget(t);
                }}
                delayLongPress={300}>
                <View style={styles.torrentTop}>
                  {selectionMode && (
                    <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(150)}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <MaterialIcons name="check" size={14} color={colors.textInverted} />}
                      </View>
                    </Animated.View>
                  )}
                  <Text style={styles.torrentName} numberOfLines={1}>{t.name}</Text>
                  <View style={[styles.badge, { borderColor: badgeColor }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                      {getStateLabel(t.state)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBg}>
                  <View
                    style={[styles.progressFill, { width: toPercent(t.progress) }]}
                  />
                </View>

                <View style={styles.torrentMeta}>
                  <Text style={styles.metaText}>{(t.progress * 100).toFixed(1)}%</Text>
                  <Text style={styles.metaText}>{formatBytes(t.size)}</Text>
                  <Text style={styles.metaDl}>↓ {formatSpeed(t.dlspeed)}</Text>
                  <Text style={styles.metaUl}>↑ {formatSpeed(t.upspeed)}</Text>
                  <Text style={styles.metaText}>ETA {formatETA(t.eta)}</Text>
                  <Text style={styles.metaRatio}>R {formatRatio(t.ratio)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      </Animated.View>

      <DeleteConfirmModal
        visible={!!deleteTarget}
        torrentName={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(deleteFiles) => {
          if (deleteTarget) {
            doAction({ action: 'delete', hashes: [deleteTarget.hash], deleteFiles });
          }
          setDeleteTarget(null);
        }}
      />

      <TorrentActionSheet
        torrent={sheetTarget}
        onClose={() => setSheetTarget(null)}
        onSelect={(hash) => enterSelectionMode(hash)}
        onDelete={(t) => confirmDelete(t.hash, t.name)}
      />

      <TaxonomyFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
      />

      <CategoryPickerSheet
        visible={selectionPicker === 'category'}
        hashes={Array.from(selectedHashes)}
        current={sharedCategory}
        onClose={() => setSelectionPicker(null)}
      />

      <TagPickerSheet
        visible={selectionPicker === 'tags'}
        hashes={Array.from(selectedHashes)}
        current={sharedTags}
        onClose={() => setSelectionPicker(null)}
      />

      <DeleteConfirmModal
        visible={bulkDeleteVisible}
        count={selectedHashes.size}
        onCancel={() => setBulkDeleteVisible(false)}
        onConfirm={(deleteFiles) => {
          const hashes = Array.from(selectedHashes);
          setBulkDeleteVisible(false);
          doAction(
            { action: 'delete', hashes, deleteFiles },
            { onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Action failed') }
          );
          triggerSelectionExit();
        }}
      />
    </SafeAreaView>
  );
}

/** Shows an active category/tag filter with a way to clear it. */
function ActiveFilterChip({
  icon,
  label,
  onClear,
}: {
  icon: MaterialIconName;
  label: string;
  onClear: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();

  return (
    <View style={styles.activeChip}>
      <MaterialIcons name={icon} size={13} color={colors.accentText} />
      <Text style={styles.activeChipText} numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`Clear ${label} filter`}>
        <MaterialIcons name="close" size={14} color={colors.accentText} />
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { color: c.text, fontSize: 20, fontWeight: '700' },
    speeds: { flexDirection: 'row', gap: 12 },
    speedDl: { color: c.accent, fontSize: 13, fontWeight: '600' },
    speedUl: { color: c.stateGreen, fontSize: 13, fontWeight: '600' },
    disconnected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    disconnectedText: { color: c.danger, fontSize: 13, fontWeight: '600' },
    reconnectBtn: { padding: 2 },
    selectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: c.selectionBar,
      borderBottomWidth: 1,
      borderBottomColor: c.selectionBorder,
    },
    selBarIconBtn: { padding: 2 },
    selBarCount: { color: c.text, fontSize: 16, fontWeight: '700', flex: 1 },
    selActionsWrap: {
      backgroundColor: c.selectionSurface,
      borderBottomWidth: 1,
      borderBottomColor: c.selectionBorder,
    },
    selActionsRow: { paddingHorizontal: 10, paddingVertical: 8, gap: 8, alignItems: 'center' },
    selActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    selActionBtnDanger: { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder },
    selActionBtnDisabled: { opacity: 0.4 },
    selActionText: { color: c.text, fontSize: 13, fontWeight: '600' },
    selActionTextDanger: { color: c.dangerText },
    searchWrap: { paddingHorizontal: 12, paddingVertical: 8 },
    search: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
    },
    filterWrap: {
      minHeight: 48,
      justifyContent: 'center',
    },
    filterBar: { flexDirection: 'row', alignItems: 'center' },
    filterScroll: { flexGrow: 0, flexShrink: 1 },
    labelsBtn: {
      marginRight: 12,
      marginLeft: 4,
      padding: 8,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    labelsBtnActive: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    activeFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 6,
    },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 220,
      paddingLeft: 10,
      paddingRight: 8,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accentBorder,
    },
    activeChipText: { color: c.accentText, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    filterRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, alignItems: 'center' },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    filterChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
    filterLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    filterLabelActive: { color: c.accentText },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    countText: { color: c.textSubtle, fontSize: 12 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyContainer: { flexGrow: 1 },
    errorText: { color: c.danger, marginBottom: 12, fontWeight: '600' },
    retryBtn: {
      backgroundColor: c.surfaceRaised,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    retryText: { color: c.text },
    emptyText: { color: c.textSubtle, fontSize: 15 },
    torrentRow: {
      backgroundColor: c.card,
      marginHorizontal: 12,
      marginVertical: 4,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    torrentRowSelected: {
      borderColor: c.accentBorder,
      backgroundColor: c.selectionBar,
    },
    torrentTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.borderStrong,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: {
      borderColor: c.accentBorder,
      backgroundColor: c.accentStrong,
    },
    torrentName: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
    badge: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    progressBg: {
      height: 3,
      backgroundColor: c.surfaceRaised,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: c.accent, borderRadius: 2 },
    torrentMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    metaText: { color: c.textSecondary, fontSize: 12 },
    metaDl: { color: c.accent, fontSize: 12 },
    metaUl: { color: c.stateGreen, fontSize: 12 },
    metaRatio: { color: c.statePurple, fontSize: 12 },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 'auto',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    sortBtnText: { color: c.textSubtle, fontSize: 12 },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    sortSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 16,
      paddingBottom: 32,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderColor: c.border,
    },
    sortSheetTitle: {
      color: c.textSubtle,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 10,
    },
    sortOptionActive: { backgroundColor: c.accentSoft },
    sortOptionText: { color: c.text, fontSize: 15 },
    sortOptionTextActive: { color: c.accentText, fontWeight: '600' },
  });
