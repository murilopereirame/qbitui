import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';

import { CategoryPickerSheet, TagPickerSheet } from '@/components/TaxonomySheets';
import { stateColor as stateTokenColor, type ThemeColors } from '@/constants/theme';
import { useApi, useTorrentAction, useTorrents } from '@/hooks/use-qbit';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { Torrent, TorrentAction } from '@/lib/types';
import { FILTER_STATES, getStateColor, getStateLabel, parseTorrentTags } from '@/lib/utils';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface Props {
  /** The torrent the sheet acts on, or null when hidden. */
  torrent: Torrent | null;
  onClose: () => void;
  /** Enter multi-select mode seeded with this torrent. */
  onSelect: (hash: string) => void;
  /** Open the delete confirmation for this torrent. */
  onDelete: (torrent: Torrent) => void;
}

function buildMagnet(t: Torrent): string {
  if (t.magnet_uri) return t.magnet_uri;
  return `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(t.name)}`;
}

function torrentPath(t: Torrent): string {
  return t.content_path || t.save_path || '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ._-]/g, '_').slice(0, 200) || 'torrent';
}

export function TorrentActionSheet({ torrent: target, onClose, onSelect, onDelete }: Props) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  const api = useApi();
  const { mutate: doAction } = useTorrentAction();
  const { data: torrents } = useTorrents();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [picker, setPicker] = useState<'category' | 'tags' | null>(null);

  const visible = !!target;
  // The sheet is opened with a snapshot of the row; category and tags change
  // from inside it, so read them back from the live torrent list.
  const torrent = torrents?.find((t) => t.hash === target?.hash) ?? target;
  const tags = parseTorrentTags(torrent?.tags);

  function close() {
    setFeedback(null);
    setPicker(null);
    onClose();
  }

  function notify(message: string) {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      close();
    } else {
      // No native toast on iOS/web — flash the message in the sheet, then dismiss.
      setFeedback(message);
      setTimeout(close, 850);
    }
  }

  function runAction(action: TorrentAction) {
    if (!torrent) return;
    doAction(
      { action, hashes: [torrent.hash] },
      { onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Action failed') }
    );
    close();
  }

  async function copy(label: string, value: string) {
    if (!value) {
      notify(`No ${label.toLowerCase()} to copy`);
      return;
    }
    try {
      await Clipboard.setStringAsync(value);
      notify(`Copied ${label}`);
    } catch {
      Alert.alert('Error', `Failed to copy ${label.toLowerCase()}`);
    }
  }

  async function exportTorrent() {
    if (!torrent || !api) return;
    setExporting(true);
    try {
      const { url, headers } = api.buildExportRequest(torrent.hash);
      const dest = new File(Paths.cache, `${sanitizeFileName(torrent.name)}.torrent`);
      const file = await File.downloadFileAsync(url, dest, { headers, idempotent: true });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/x-bittorrent',
          UTI: 'org.bittorrent.torrent',
          dialogTitle: 'Export .torrent',
        });
        close();
      } else {
        notify('Saved .torrent to cache');
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not export .torrent');
    } finally {
      setExporting(false);
    }
  }

  const isPaused = torrent ? FILTER_STATES.paused.includes(torrent.state) : false;
  const stateColor = torrent ? stateTokenColor(colors, getStateColor(torrent.state)) : colors.stateGray;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        {/* Stop propagation so taps inside the sheet don't dismiss it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {torrent && (
            <>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={2}>
                  {torrent.name}
                </Text>
                <View style={[styles.badge, { borderColor: stateColor }]}>
                  <Text style={[styles.badgeText, { color: stateColor }]}>
                    {getStateLabel(torrent.state)}
                  </Text>
                </View>
              </View>

              {feedback && (
                <View style={styles.feedback}>
                  <MaterialIcons name="check-circle" size={16} color={colors.stateGreen} />
                  <Text style={styles.feedbackText}>{feedback}</Text>
                </View>
              )}

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Manage */}
                <Text style={styles.sectionLabel}>Manage</Text>
                <View style={styles.iconRow}>
                  <IconAction
                    icon={isPaused ? 'play-arrow' : 'pause'}
                    label={isPaused ? 'Resume' : 'Pause'}
                    onPress={() => runAction(isPaused ? 'resume' : 'pause')}
                  />
                  <IconAction icon="refresh" label="Recheck" onPress={() => runAction('recheck')} />
                  <IconAction icon="campaign" label="Reannounce" onPress={() => runAction('reannounce')} />
                </View>
                <View style={styles.iconRow}>
                  <IconAction icon="vertical-align-top" label="Top" onPress={() => runAction('topPrio')} />
                  <IconAction icon="arrow-upward" label="Up" onPress={() => runAction('increasePrio')} />
                  <IconAction icon="arrow-downward" label="Down" onPress={() => runAction('decreasePrio')} />
                  <IconAction icon="vertical-align-bottom" label="Bottom" onPress={() => runAction('bottomPrio')} />
                </View>

                <View style={styles.divider} />

                {/* Organise */}
                <Text style={styles.sectionLabel}>Organise</Text>
                <ListRow
                  icon="folder"
                  label="Category"
                  onPress={() => setPicker('category')}
                  trailing={
                    <Text style={styles.trailingText} numberOfLines={1}>
                      {torrent.category || 'None'}
                    </Text>
                  }
                />
                <ListRow
                  icon="label"
                  label="Tags"
                  onPress={() => setPicker('tags')}
                  trailing={
                    <Text style={styles.trailingText} numberOfLines={1}>
                      {tags.length > 0 ? tags.join(', ') : 'None'}
                    </Text>
                  }
                />

                <View style={styles.divider} />

                {/* Copy */}
                <Text style={styles.sectionLabel}>Copy</Text>
                <ListRow icon="title" label="Name" onPress={() => copy('Name', torrent.name)} />
                <ListRow icon="tag" label="Hash" onPress={() => copy('Hash', torrent.hash)} />
                <ListRow icon="link" label="Magnet link" onPress={() => copy('Magnet link', buildMagnet(torrent))} />
                <ListRow icon="folder" label="Path" onPress={() => copy('Path', torrentPath(torrent))} />

                <View style={styles.divider} />

                {/* File / selection */}
                <ListRow
                  icon="download"
                  label="Export .torrent"
                  onPress={exportTorrent}
                  trailing={exporting ? <ActivityIndicator size="small" color={colors.accentText} /> : undefined}
                  disabled={exporting}
                />
                <ListRow
                  icon="checklist"
                  label="Select"
                  onPress={() => {
                    onSelect(torrent.hash);
                    close();
                  }}
                />

                <View style={styles.divider} />

                <ListRow
                  icon="delete"
                  label="Delete"
                  danger
                  onPress={() => {
                    onDelete(torrent);
                    close();
                  }}
                />
              </ScrollView>

              <Pressable style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              {/* Nested inside this modal so iOS presents them over the sheet. */}
              <CategoryPickerSheet
                visible={picker === 'category'}
                hashes={[torrent.hash]}
                current={torrent.category ?? ''}
                onClose={() => setPicker(null)}
              />
              <TagPickerSheet
                visible={picker === 'tags'}
                hashes={[torrent.hash]}
                current={tags}
                onClose={() => setPicker(null)}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  return (
    <Pressable style={styles.iconAction} onPress={onPress}>
      <MaterialIcons name={icon} size={22} color={colors.text} />
      <Text style={styles.iconActionLabel}>{label}</Text>
    </Pressable>
  );
}

function ListRow({
  icon,
  label,
  onPress,
  danger,
  disabled,
  trailing,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useTheme();
  return (
    <Pressable
      style={[styles.listRow, disabled && styles.listRowDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <MaterialIcons name={icon} size={20} color={danger ? colors.dangerText : colors.textSecondary} />
      <Text style={[styles.listLabel, danger && styles.listLabelDanger]}>{label}</Text>
      <View style={styles.listTrailing}>{trailing}</View>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.chrome,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 20,
      borderTopWidth: 1,
      borderColor: c.border,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 8,
    },
    title: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
    badge: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    feedback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.selectionBar,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
    },
    feedbackText: { color: c.stateGreen, fontSize: 13, fontWeight: '600' },
    scroll: { flexGrow: 0 },
    scrollContent: { paddingBottom: 8 },
    sectionLabel: {
      color: c.textSubtle,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 4,
      marginBottom: 8,
    },
    iconRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    iconAction: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconActionLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    listRowDisabled: { opacity: 0.5 },
    listLabel: { color: c.text, fontSize: 15, fontWeight: '500', flex: 1 },
    listLabelDanger: { color: c.dangerText },
    listTrailing: { minWidth: 20, maxWidth: 160, alignItems: 'flex-end' },
    trailingText: { color: c.textSubtle, fontSize: 13 },
    cancelBtn: {
      marginTop: 8,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    cancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  });
