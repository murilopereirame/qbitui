import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTorrentAction, useTorrents, useTransfer } from '@/hooks/use-qbit';
import { formatBytes, formatETA, formatSpeed, FILTER_STATES, getStateColor, getStateLabel, toPercent } from '@/lib/utils';
import { TorrentAction, TorrentFilter } from '@/lib/types';
import { useUIStore } from '@/store';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];
type SELECTION_ACTION = Exclude<TorrentAction, 'recheck' | 'reannounce'>;

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

const STATE_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  gray: '#6b7280',
  purple: '#a855f7',
  orange: '#f97316',
  red: '#ef4444',
  cyan: '#06b6d4',
};

export default function TorrentsScreen() {
  const router = useRouter();
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
  } = useUIStore();
  const { filteredTorrents, isLoading, isError, refetch, isFetching } = useTorrents();
  const { data: transfer } = useTransfer();
  const { mutate: doAction } = useTorrentAction();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ hash: string; name: string } | null>(null);
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const allSelected =
    filteredTorrents.length > 0 && filteredTorrents.every((t) => selectedHashes.has(t.hash));

  // Android hardware back exits selection mode instead of leaving the screen.
  useEffect(() => {
    if (!selectionMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
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
        onSuccess: () => clearSelection(),
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Action failed'),
      }
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header / Selection bar */}
      {selectionMode ? (
        <>
          <View style={styles.selectionBar}>
            <Pressable onPress={clearSelection} hitSlop={8} style={styles.selBarIconBtn}>
              <MaterialIcons name="close" size={22} color="#e2e8f0" />
            </Pressable>
            <Text style={styles.selBarCount}>{selectedHashes.size} selected</Text>
            <Pressable onPress={toggleSelectAll} hitSlop={8} style={styles.selBarIconBtn}>
              <MaterialIcons name={allSelected ? 'done-all' : 'select-all'} size={22} color="#e2e8f0" />
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
                    <MaterialIcons name={icon} size={18} color={danger ? '#fca5a5' : '#e2e8f0'} />
                    <Text style={[styles.selActionText, danger && styles.selActionTextDanger]}>
                      {label}
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
              <MaterialIcons name="wifi-off" size={14} color="#ef4444" />
              <Text style={styles.disconnectedText}>Disconnected</Text>
              <Pressable onPress={() => refetch()} style={styles.reconnectBtn} hitSlop={8}>
                <MaterialIcons name="refresh" size={18} color="#ef4444" />
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

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search torrents…"
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterWrap}>
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
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredTorrents.length} torrent{filteredTorrents.length !== 1 ? 's' : ''}
        </Text>
        {isFetching && !refreshing && <ActivityIndicator size="small" color="#3b82f6" />}
      </View>

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
          <ActivityIndicator color="#3b82f6" size="large" />
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
              tintColor="#3b82f6"
            />
          }
          contentContainerStyle={filteredTorrents.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No torrents found</Text>
            </View>
          }
          renderItem={({ item: t }) => {
            const stateColorKey = getStateColor(t.state);
            const stateColor = STATE_COLORS[stateColorKey] ?? '#6b7280';
            const isPaused = FILTER_STATES.paused.includes(t.state);
            const isSelected = selectedHashes.has(t.hash);

            return (
              <Pressable
                style={[styles.torrentRow, isSelected && styles.torrentRowSelected]}
                onPress={() => {
                  if (selectionMode) toggleSelection(t.hash);
                  else router.push(`/torrent/${t.hash}`);
                }}
                onLongPress={() => enterSelectionMode(t.hash)}
                delayLongPress={300}>
                <View style={styles.torrentTop}>
                  {selectionMode && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <MaterialIcons name="check" size={14} color="#fff" />}
                    </View>
                  )}
                  <Text style={styles.torrentName} numberOfLines={1}>{t.name}</Text>
                  <View style={[styles.badge, { borderColor: stateColor }]}>
                    <Text style={[styles.badgeText, { color: stateColor }]}>
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
                </View>

                {!selectionMode && (
                  <View style={styles.torrentActions}>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() =>
                        doAction({ action: isPaused ? 'resume' : 'pause', hashes: [t.hash] })
                      }>
                      <MaterialIcons
                        name={isPaused ? 'play-arrow' : 'pause'}
                        size={20}
                        color="#e2e8f0"
                      />
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => confirmDelete(t.hash, t.name)}>
                      <MaterialIcons name="delete" size={20} color="#fca5a5" />
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

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
          clearSelection();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  speeds: { flexDirection: 'row', gap: 12 },
  speedDl: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  speedUl: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  disconnected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disconnectedText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  reconnectBtn: { padding: 2 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0f1e3d',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  selBarIconBtn: { padding: 2 },
  selBarCount: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  selActionsWrap: {
    backgroundColor: '#0b1730',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  selActionsRow: { paddingHorizontal: 10, paddingVertical: 8, gap: 8, alignItems: 'center' },
  selActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  selActionBtnDanger: { backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  selActionBtnDisabled: { opacity: 0.4 },
  selActionText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  selActionTextDanger: { color: '#fca5a5' },
  searchWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  search: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  filterWrap: {
    minHeight: 48,
    justifyContent: 'center',
  },
  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  filterChipActive: { backgroundColor: '#1d4ed8', borderColor: '#3b82f6' },
  filterLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  filterLabelActive: { color: '#93c5fd' },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  countText: { color: '#6b7280', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContainer: { flexGrow: 1 },
  errorText: { color: '#ef4444', marginBottom: 12, fontWeight: '600' },
  retryBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#fff' },
  emptyText: { color: '#6b7280', fontSize: 15 },
  torrentRow: {
    backgroundColor: '#0f172a',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 8,
  },
  torrentRowSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#0f1e3d',
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
    borderColor: '#374151',
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#2563eb',
  },
  torrentName: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', flex: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  progressBg: {
    height: 3,
    backgroundColor: '#1f2937',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  torrentMeta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaText: { color: '#9ca3af', fontSize: 12 },
  metaDl: { color: '#3b82f6', fontSize: 12 },
  metaUl: { color: '#22c55e', fontSize: 12 },
  torrentActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  actionBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: { backgroundColor: '#450a0a' },
});
