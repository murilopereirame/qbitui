import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logger, LogEntry } from '@/lib/logger';

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  info: '#93c5fd',
  warn: '#fbbf24',
  error: '#f87171',
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export default function LogsScreen() {
  const [entries, setEntries] = useState<readonly LogEntry[]>(() => logger.getLogs());

  useEffect(() => {
    return logger.subscribe(() => {
      setEntries(logger.getLogs());
    });
  }, []);

  const handleClear = useCallback(() => {
    logger.clear();
  }, []);

  const renderItem = useCallback(({ item }: { item: LogEntry }) => (
    <View style={styles.row}>
      <Text style={styles.ts}>{formatTs(item.ts)}</Text>
      <Text style={[styles.level, { color: LEVEL_COLORS[item.level] }]}>
        {item.level.toUpperCase()}
      </Text>
      {item.ctx && <Text style={styles.ctx}>[{item.ctx}]</Text>}
      <Text style={styles.msg} selectable>{item.msg}</Text>
    </View>
  ), []);

  const reversed = [...entries].reverse();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{entries.length} entries</Text>
        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {reversed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No log entries yet</Text>
        </View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#030712' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  count: { color: '#6b7280', fontSize: 12 },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  clearText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2937',
    gap: 6,
    alignItems: 'flex-start',
  },
  ts: { color: '#4b5563', fontSize: 11, fontFamily: 'monospace' },
  level: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace', minWidth: 40 },
  ctx: { color: '#6b7280', fontSize: 11, fontFamily: 'monospace' },
  msg: { color: '#e2e8f0', fontSize: 12, flex: 1, flexShrink: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#4b5563', fontSize: 14 },
});
