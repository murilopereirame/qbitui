import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSetTorrentFilePriority, useTorrentDetails, useTorrents } from '@/hooks/use-qbit';
import { formatBytes, formatDate, formatETA, formatRatio, formatSpeed, toPercent } from '@/lib/utils';
import { TorrentFile } from '@/lib/types';

type Tab = 'properties' | 'trackers' | 'files';

export default function TorrentDetailsScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('properties');

  const { data: torrents } = useTorrents();
  const torrent = torrents?.find((t) => t.hash === hash);

  const { properties, trackers, files } = useTorrentDetails(hash);
  const { mutate: setFilePriority, isPending: isSettingFilePriority } = useSetTorrentFilePriority();
  const [pendingFileIndexes, setPendingFileIndexes] = useState<Set<number>>(new Set());

  function updateFilePriority(file: TorrentFile, priority: number) {
    if (!hash || file.priority === priority) return;
    setPendingFileIndexes((prev) => new Set(prev).add(file.index));
    setFilePriority(
      { hash, fileIds: [file.index], priority },
      {
        onSettled: () => {
          setPendingFileIndexes((prev) => {
            const next = new Set(prev);
            next.delete(file.index);
            return next;
          });
        },
        onError: (error) => {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change file priority');
        },
      }
    );
  }

  useEffect(() => {
    if (torrent?.name) {
      navigation.setOptions({ title: torrent.name });
    }
  }, [torrent?.name, navigation]);

  if (!hash) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['properties', 'trackers', 'files'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'properties' && (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {properties.isLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ margin: 24 }} />
          ) : properties.data ? (
            <>
              <PropRow label="Save Path" value={properties.data.save_path} />
              <PropRow label="Created By" value={properties.data.created_by || '—'} />
              <PropRow label="Comment" value={properties.data.comment || '—'} />
              <PropRow label="Total Size" value={formatBytes(properties.data.total_size)} />
              <PropRow label="Downloaded" value={formatBytes(properties.data.total_downloaded)} />
              <PropRow label="Uploaded" value={formatBytes(properties.data.total_uploaded)} />
              <PropRow label="Ratio" value={formatRatio(properties.data.share_ratio)} />
              <PropRow label="DL Speed" value={formatSpeed(properties.data.dl_speed)} />
              <PropRow label="UL Speed" value={formatSpeed(properties.data.up_speed)} />
              <PropRow label="Seeds" value={`${properties.data.seeds} / ${properties.data.seeds_total}`} />
              <PropRow label="Peers" value={`${properties.data.peers} / ${properties.data.peers_total}`} />
              <PropRow label="ETA" value={formatETA(properties.data.eta)} />
              <PropRow label="Connections" value={`${properties.data.nb_connections} / ${properties.data.nb_connections_limit}`} />
              <PropRow label="Added On" value={formatDate(properties.data.addition_date)} />
              <PropRow label="Completed On" value={formatDate(properties.data.completion_date)} />
              <PropRow label="Pieces" value={`${properties.data.pieces_num} × ${formatBytes(properties.data.piece_size)}`} />
              <PropRow label="Hash v1" value={properties.data.infohash_v1 || '—'} />
              <PropRow label="Hash v2" value={properties.data.infohash_v2 || '—'} />
            </>
          ) : (
            <Text style={styles.noData}>No properties available</Text>
          )}
        </ScrollView>
      )}

      {activeTab === 'trackers' && (
        <FlatList
          data={trackers.data ?? []}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={
            trackers.isLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ margin: 24 }} />
            ) : (
              <Text style={styles.noData}>No trackers</Text>
            )
          }
          renderItem={({ item: tracker }) => (
            <View style={styles.trackerRow}>
              <Text style={styles.trackerUrl} numberOfLines={1}>{tracker.url}</Text>
              <View style={styles.trackerMeta}>
                <Text style={styles.metaText}>Seeds: {tracker.num_seeds}</Text>
                <Text style={styles.metaText}>Peers: {tracker.num_peers}</Text>
                <Text style={[styles.metaText, tracker.msg ? styles.trackerMsg : undefined]}>
                  {tracker.msg || 'Working'}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {activeTab === 'files' && (
        <FlatList
          data={files.data ?? []}
          keyExtractor={(f) => String(f.index)}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={
            files.isLoading ? (
              <ActivityIndicator color="#3b82f6" style={{ margin: 24 }} />
            ) : (
              <Text style={styles.noData}>No files</Text>
            )
          }
          renderItem={({ item: file }) => (
            <View style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              <View style={styles.fileMeta}>
                <Text style={styles.metaText}>{formatBytes(file.size)}</Text>
                <Text style={styles.metaText}>{(file.progress * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.filePriorityRow}>
                {FILE_PRIORITIES.map((option) => {
                  const isActive = file.priority === option.value;
                  const isCurrentFileUpdating =
                    isSettingFilePriority && pendingFileIndexes.has(file.index);
                  return (
                    <Pressable
                      key={`${file.index}-${option.value}`}
                      style={[
                        styles.filePriorityButton,
                        isActive && styles.filePriorityButtonActive,
                        isCurrentFileUpdating && styles.filePriorityButtonDisabled,
                      ]}
                      disabled={isCurrentFileUpdating}
                      onPress={() => updateFilePriority(file, option.value)}>
                      <Text style={[styles.filePriorityText, isActive && styles.filePriorityTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    { width: toPercent(file.progress) },
                  ]}
                />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const FILE_PRIORITIES = [
  { value: 0, label: 'Skip' },
  { value: 1, label: 'Normal' },
  { value: 6, label: 'High' },
  { value: 7, label: 'Max' },
];

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={propStyles.row}>
      <Text style={propStyles.label}>{label}</Text>
      <Text style={propStyles.value} selectable>{value}</Text>
    </View>
  );
}

const propStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 12,
  },
  label: { color: '#9ca3af', fontSize: 13, flex: 0.45 },
  value: { color: '#f1f5f9', fontSize: 13, flex: 0.55, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#0f172a',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#3b82f6' },
  tabContent: { paddingBottom: 24 },
  noData: { color: '#6b7280', textAlign: 'center', marginTop: 32 },
  trackerRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 4,
  },
  trackerUrl: { color: '#e2e8f0', fontSize: 13, fontWeight: '500' },
  trackerMeta: { flexDirection: 'row', gap: 12 },
  trackerMsg: { color: '#9ca3af', fontStyle: 'italic' },
  metaText: { color: '#9ca3af', fontSize: 12 },
  fileRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 4,
  },
  fileName: { color: '#e2e8f0', fontSize: 13 },
  fileMeta: { flexDirection: 'row', gap: 12 },
  filePriorityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  filePriorityButton: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filePriorityButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1d4ed8',
  },
  filePriorityButtonDisabled: {
    opacity: 0.6,
  },
  filePriorityText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },
  filePriorityTextActive: { color: '#bfdbfe' },
  progressBg: {
    height: 3,
    backgroundColor: '#1f2937',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
});
