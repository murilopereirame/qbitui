import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { logger, LogEntry } from '@/lib/logger';

function levelColor(colors: ThemeColors, level: LogEntry['level']): string {
  if (level === 'warn') return colors.stateYellow;
  if (level === 'error') return colors.danger;
  return colors.accentText;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export default function LogsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
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
      <Text style={[styles.level, { color: levelColor(colors, item.level) }]}>
        {item.level.toUpperCase()}
      </Text>
      {item.ctx && <Text style={styles.ctx}>[{item.ctx}]</Text>}
      <Text style={styles.msg} selectable>{item.msg}</Text>
      {item.body !== undefined && (
        <Text style={styles.body} selectable>{item.body}</Text>
      )}
    </View>
  ), [colors, styles]);

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

const createStyles = (c: ThemeColors) =>
StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    count: { color: c.textSubtle, fontSize: 12 },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.surfaceRaised,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    clearText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    list: { paddingVertical: 4 },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 6,
      alignItems: 'flex-start',
    },
    ts: { color: c.textSubtle, fontSize: 11, fontFamily: 'monospace' },
    level: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace', minWidth: 40 },
    ctx: { color: c.textSubtle, fontSize: 11, fontFamily: 'monospace' },
    msg: { color: c.text, fontSize: 12, flex: 1, flexShrink: 1 },
    body: { color: c.textSubtle, fontSize: 11, fontFamily: 'monospace', width: '100%', marginTop: 2 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: c.textSubtle, fontSize: 14 },
  });
