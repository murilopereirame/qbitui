import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTorrentDetails } from '../hooks/useTorrentDetails';
import { formatBytes, formatSpeed, formatETA, formatDate } from '@qbitui/core';

type Props = NativeStackScreenProps<RootStackParamList, 'TorrentDetail'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function TorrentDetailScreen({ route }: Props) {
  const { hash } = route.params;
  const { data, isLoading } = useTorrentDetails(hash);

  if (isLoading || !data) {
    return <ActivityIndicator style={styles.loader} color="#2563eb" size="large" />;
  }

  const { properties: p, trackers, peers, files } = data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Properties</Text>
      <View style={styles.card}>
        <Row label="Size" value={formatBytes(p.total_size)} />
        <Row label="Downloaded" value={formatBytes(p.total_downloaded)} />
        <Row label="Uploaded" value={formatBytes(p.total_uploaded)} />
        <Row label="Download Speed" value={formatSpeed(p.dl_speed)} />
        <Row label="Upload Speed" value={formatSpeed(p.up_speed)} />
        <Row label="ETA" value={formatETA(p.eta)} />
        <Row label="Seeds" value={`${p.seeds} / ${p.seeds_total}`} />
        <Row label="Peers" value={`${p.peers} / ${p.peers_total}`} />
        <Row label="Ratio" value={p.share_ratio.toFixed(2)} />
        <Row label="Added" value={formatDate(p.addition_date)} />
        <Row label="Save Path" value={p.save_path} />
      </View>

      <Text style={styles.sectionTitle}>Trackers ({trackers.length})</Text>
      <View style={styles.card}>
        {trackers.length === 0 ? (
          <Text style={styles.empty}>No trackers</Text>
        ) : (
          trackers.slice(0, 10).map((t, i) => (
            <View key={i} style={styles.trackerRow}>
              <Text style={styles.trackerUrl} numberOfLines={1}>{t.url}</Text>
              <Text style={styles.trackerPeers}>{t.num_peers} peers</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Files ({files.length})</Text>
      <View style={styles.card}>
        {files.length === 0 ? (
          <Text style={styles.empty}>No files</Text>
        ) : (
          files.map((f) => (
            <View key={f.index} style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={2}>{f.name}</Text>
              <Text style={styles.fileSize}>{formatBytes(f.size)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16 },
  loader: { flex: 1 },
  sectionTitle: { color: '#9ca3af', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#111827', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  rowLabel: { color: '#6b7280', fontSize: 14 },
  rowValue: { color: '#f9fafb', fontSize: 14, flex: 1, textAlign: 'right' },
  empty: { color: '#6b7280', padding: 14 },
  trackerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  trackerUrl: { flex: 1, color: '#d1d5db', fontSize: 13 },
  trackerPeers: { color: '#9ca3af', fontSize: 12, marginLeft: 8 },
  fileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  fileName: { flex: 1, color: '#d1d5db', fontSize: 13 },
  fileSize: { color: '#9ca3af', fontSize: 12, marginLeft: 8 },
});
