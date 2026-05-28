import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  const [selectedFileIndexes, setSelectedFileIndexes] = useState<Set<number>>(new Set());
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);

  const { data: torrents } = useTorrents();
  const torrent = torrents?.find((t) => t.hash === hash);

  const { properties, trackers, files } = useTorrentDetails(hash);
  const { mutate: setFilePriority, isPending: isSettingFilePriority } = useSetTorrentFilePriority();
  const [pendingFileIndexes, setPendingFileIndexes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (activeTab !== 'files') setSelectedFileIndexes(new Set());
  }, [activeTab]);

  function toggleFileSelection(index: number) {
    setSelectedFileIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!files.data) return;
    if (selectedFileIndexes.size === files.data.length) {
      setSelectedFileIndexes(new Set());
    } else {
      setSelectedFileIndexes(new Set(files.data.map((f) => f.index)));
    }
  }

  function clearFileSelection() {
    setSelectedFileIndexes(new Set());
  }

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

  function bulkSetPriority(priority: number) {
    if (!hash || selectedFileIndexes.size === 0) return;
    const fileIds = Array.from(selectedFileIndexes);
    setFilePriority(
      { hash, fileIds, priority },
      {
        onSuccess: () => clearFileSelection(),
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

  const allSelected = !!files.data?.length && selectedFileIndexes.size === files.data.length;

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
        <>
          <FlatList
            style={styles.fileList}
            data={files.data ?? []}
            keyExtractor={(f) => String(f.index)}
            contentContainerStyle={styles.tabContent}
            ListHeaderComponent={
              files.data && files.data.length > 0 ? (
                <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
                  <View style={[styles.checkbox, allSelected && styles.checkboxSelected]}>
                    {allSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.selectAllText}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              files.isLoading ? (
                <ActivityIndicator color="#3b82f6" style={{ margin: 24 }} />
              ) : (
                <Text style={styles.noData}>No files</Text>
              )
            }
            renderItem={({ item: file }) => {
              const isSelected = selectedFileIndexes.has(file.index);
              const isCurrentFileUpdating =
                isSettingFilePriority && pendingFileIndexes.has(file.index);
              return (
                <View style={styles.fileRow}>
                  <Pressable
                    style={styles.checkboxWrap}
                    onPress={() => toggleFileSelection(file.index)}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </Pressable>
                  <View style={styles.fileRowContent}>
                    <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                    <View style={styles.fileMeta}>
                      <Text style={styles.metaText}>{formatBytes(file.size)}</Text>
                      <Text style={styles.metaText}>{(file.progress * 100).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.filePriorityRow}>
                      {FILE_PRIORITIES.map((option) => {
                        const isActive = file.priority === option.value;
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
                </View>
              );
            }}
          />
          {selectedFileIndexes.size > 0 && (
            <View style={styles.bulkBar}>
              <Text style={styles.bulkCount}>{selectedFileIndexes.size} selected</Text>
              <Pressable
                style={[styles.bulkPriorityButton, isSettingFilePriority && styles.bulkPriorityButtonDisabled]}
                onPress={() => setPriorityPickerOpen(true)}
                disabled={isSettingFilePriority}>
                <Text style={styles.bulkPriorityText}>Set Priority…</Text>
              </Pressable>
              <Pressable onPress={clearFileSelection} style={styles.bulkClear}>
                <Text style={styles.bulkClearText}>✕</Text>
              </Pressable>
            </View>
          )}

          <Modal
            visible={priorityPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setPriorityPickerOpen(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setPriorityPickerOpen(false)}>
              <View style={styles.prioritySheet}>
                <Text style={styles.sheetTitle}>Set Priority</Text>
                {FILE_PRIORITIES.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.sheetOption}
                    onPress={() => {
                      setPriorityPickerOpen(false);
                      bulkSetPriority(opt.value);
                    }}>
                    <Text style={styles.sheetOptionText}>{opt.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.sheetCancel} onPress={() => setPriorityPickerOpen(false)}>
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </>
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
  fileList: { flex: 1 },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 10,
  },
  selectAllText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  checkboxWrap: {
    paddingTop: 2,
    paddingRight: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
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
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  fileRowContent: {
    flex: 1,
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
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 8,
  },
  bulkCount: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 64,
  },
  bulkPriorityButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  bulkPriorityButtonDisabled: {
    opacity: 0.5,
  },
  bulkPriorityText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  bulkClear: {
    padding: 6,
  },
  bulkClearText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  prioritySheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
    gap: 4,
    borderTopWidth: 1,
    borderColor: '#374151',
  },
  sheetTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetOption: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sheetOptionText: {
    color: '#f1f5f9',
    fontSize: 16,
  },
  sheetCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
