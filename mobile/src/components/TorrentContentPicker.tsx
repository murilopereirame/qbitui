import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { buildContentTree, visibleNodes, type ContentNode } from '@/lib/file-tree';
import { TorrentFile } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

interface Props {
  name: string;
  files: TorrentFile[];
  totalSize: number;
  /** Indexes of the files the user wants to download. */
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
}

/**
 * Shows the contents of a torrent whose metadata has been fetched, letting the
 * user pick which files to download before it starts.
 */
export function TorrentContentPicker({ name, files, totalSize, selected, onChange }: Props) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const tree = useMemo(() => buildContentTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => visibleNodes(tree, collapsed), [tree, collapsed]);

  const selectedSize = files
    .filter((file) => selected.has(file.index))
    .reduce((total, file) => total + file.size, 0);
  const allSelected = selected.size === files.length;

  function toggleNode(node: ContentNode) {
    const next = new Set(selected);
    const isFullySelected = node.fileIndexes.every((index) => next.has(index));
    for (const index of node.fileIndexes) {
      if (isFullySelected) next.delete(index);
      else next.add(index);
    }
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(files.map((file) => file.index)));
  }

  function toggleCollapse(key: string) {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  }

  function checkboxIcon(checked: boolean, indeterminate: boolean) {
    if (indeterminate) return 'indeterminate-check-box' as const;
    return checked ? ('check-box' as const) : ('check-box-outline-blank' as const);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={toggleAll}>
        <MaterialIcons
          name={checkboxIcon(allSelected, selected.size > 0 && !allSelected)}
          size={20}
          color={selected.size > 0 ? colors.accent : colors.textSubtle}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.headerMeta}>
            {selected.size} of {files.length} files · {formatBytes(selectedSize)} of{' '}
            {formatBytes(totalSize)}
          </Text>
        </View>
      </Pressable>

      <ScrollView style={styles.rows} nestedScrollEnabled>
        {rows.map((node) => {
          const selectedCount = node.fileIndexes.filter((index) => selected.has(index)).length;
          const checked = selectedCount === node.fileIndexes.length;
          const indeterminate = selectedCount > 0 && !checked;
          return (
            <Pressable
              key={node.key}
              style={[styles.row, { paddingLeft: 10 + node.depth * 14 }]}
              onPress={() => toggleNode(node)}>
              <MaterialIcons
                name={checkboxIcon(checked, indeterminate)}
                size={20}
                color={selectedCount > 0 ? colors.accent : colors.textSubtle}
              />
              {node.isDir ? (
                <Pressable onPress={() => toggleCollapse(node.key)} hitSlop={6}>
                  <MaterialIcons
                    name={collapsed.has(node.key) ? 'chevron-right' : 'expand-more'}
                    size={18}
                    color={colors.textSubtle}
                  />
                </Pressable>
              ) : (
                <View style={styles.rowSpacer} />
              )}
              <MaterialIcons
                name={node.isDir ? 'folder' : 'insert-drive-file'}
                size={16}
                color={colors.textSubtle}
              />
              <Text
                style={[styles.rowName, node.isDir && styles.rowNameDir]}
                numberOfLines={1}>
                {node.name}
              </Text>
              <Text style={styles.rowSize}>{formatBytes(node.size)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: c.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surfaceRaised,
    },
    headerText: { flex: 1, gap: 2 },
    headerTitle: { color: c.text, fontSize: 13, fontWeight: '600' },
    headerMeta: { color: c.textSubtle, fontSize: 11 },
    rows: { maxHeight: 220 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 12,
      paddingVertical: 6,
    },
    rowSpacer: { width: 18 },
    rowName: { color: c.textSecondary, fontSize: 13, flex: 1 },
    rowNameDir: { color: c.text, fontWeight: '600' },
    rowSize: { color: c.textSubtle, fontSize: 11 },
  });
