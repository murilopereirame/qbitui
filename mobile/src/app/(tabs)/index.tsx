import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { formatBytes, formatETA, formatSpeed, FILTER_STATES, getStateColor, getStateLabel } from '@/lib/utils';
import { TorrentFilter } from '@/lib/types';
import { useUIStore } from '@/store';

const FILTERS: { key: TorrentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'downloading', label: 'DL' },
  { key: 'seeding', label: 'Seed' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Done' },
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
  const { filter, setFilter, search, setSearch } = useUIStore();
  const { filteredTorrents, isLoading, isError, refetch, isFetching } = useTorrents();
  const { data: transfer } = useTransfer();
  const { mutate: doAction } = useTorrentAction();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function confirmDelete(hash: string, name: string) {
    Alert.alert(
      'Delete Torrent',
      `Remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => doAction({ action: 'delete', hashes: [hash], deleteFiles: false }),
        },
        {
          text: 'Delete + Files',
          style: 'destructive',
          onPress: () => doAction({ action: 'delete', hashes: [hash], deleteFiles: true }),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>qbitUI</Text>
        <View style={styles.speeds}>
          <Text style={styles.speedDl}>↓ {transfer ? formatSpeed(transfer.dl_info_speed) : '—'}</Text>
          <Text style={styles.speedUl}>↑ {transfer ? formatSpeed(transfer.up_info_speed) : '—'}</Text>
        </View>
      </View>

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
      <ScrollView
        horizontal
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

            return (
              <Pressable
                style={styles.torrentRow}
                onPress={() => router.push(`/torrent/${t.hash}`)}>
                <View style={styles.torrentTop}>
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
                    style={[styles.progressFill, { width: `${(t.progress * 100).toFixed(1)}%` as `${number}%` }]}
                  />
                </View>

                <View style={styles.torrentMeta}>
                  <Text style={styles.metaText}>{(t.progress * 100).toFixed(1)}%</Text>
                  <Text style={styles.metaText}>{formatBytes(t.size)}</Text>
                  <Text style={styles.metaDl}>↓ {formatSpeed(t.dlspeed)}</Text>
                  <Text style={styles.metaUl}>↑ {formatSpeed(t.upspeed)}</Text>
                  <Text style={styles.metaText}>ETA {formatETA(t.eta)}</Text>
                </View>

                {/* Actions */}
                <View style={styles.torrentActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() =>
                      doAction({ action: isPaused ? 'resume' : 'pause', hashes: [t.hash] })
                    }>
                    <Text style={styles.actionBtnText}>{isPaused ? '▶' : '⏸'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => confirmDelete(t.hash, t.name)}>
                    <Text style={styles.actionBtnText}>🗑</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
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
  filterRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
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
  torrentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  },
  actionBtnDanger: { backgroundColor: '#450a0a' },
  actionBtnText: { fontSize: 16 },
});
