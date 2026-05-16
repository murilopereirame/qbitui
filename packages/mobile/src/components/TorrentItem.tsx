import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Torrent } from '@qbitui/core';
import { formatBytes, formatSpeed, formatETA, getStateLabel } from '@qbitui/core';

interface Props {
  torrent: Torrent;
  onPress: () => void;
}

export function TorrentItem({ torrent, onPress }: Props) {
  const stateColor = getStateColorNative(torrent.state);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{torrent.name}</Text>
        <View style={[styles.badge, { backgroundColor: stateColor.bg }]}>
          <Text style={[styles.badgeText, { color: stateColor.text }]}>{getStateLabel(torrent.state)}</Text>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.round(torrent.progress * 100)}%` }]} />
      </View>
      <View style={styles.stats}>
        <Text style={styles.stat}>↓ {formatSpeed(torrent.dlspeed)}</Text>
        <Text style={styles.stat}>↑ {formatSpeed(torrent.upspeed)}</Text>
        <Text style={styles.stat}>{formatBytes(torrent.size)}</Text>
        <Text style={styles.stat}>ETA: {formatETA(torrent.eta)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getStateColorNative(state: Torrent['state']) {
  switch (state) {
    case 'downloading':
    case 'forcedDL':
    case 'metaDL':
      return { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' };
    case 'uploading':
    case 'forcedUP':
      return { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' };
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return { bg: 'rgba(234,179,8,0.2)', text: '#facc15' };
    case 'error':
    case 'missingFiles':
      return { bg: 'rgba(239,68,68,0.2)', text: '#f87171' };
    default:
      return { bg: 'rgba(107,114,128,0.2)', text: '#9ca3af' };
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  name: { flex: 1, color: '#f9fafb', fontSize: 14, fontWeight: '500' },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  progressBarBg: { height: 4, backgroundColor: '#374151', borderRadius: 2, marginBottom: 8 },
  progressBarFill: { height: 4, backgroundColor: '#2563eb', borderRadius: 2 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { color: '#9ca3af', fontSize: 12 },
});
