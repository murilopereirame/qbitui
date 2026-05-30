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

import { useApi, useTorrentAction } from '@/hooks/use-qbit';
import { Torrent, TorrentAction } from '@/lib/types';
import { FILTER_STATES, getStateColor, getStateLabel } from '@/lib/utils';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

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

export function TorrentActionSheet({ torrent, onClose, onSelect, onDelete }: Props) {
  const api = useApi();
  const { mutate: doAction } = useTorrentAction();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const visible = !!torrent;

  function close() {
    setFeedback(null);
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
  const stateColor = torrent ? STATE_COLORS[getStateColor(torrent.state)] ?? '#6b7280' : '#6b7280';

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
                  <MaterialIcons name="check-circle" size={16} color="#22c55e" />
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
                  trailing={exporting ? <ActivityIndicator size="small" color="#93c5fd" /> : undefined}
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
  return (
    <Pressable style={styles.iconAction} onPress={onPress}>
      <MaterialIcons name={icon} size={22} color="#e2e8f0" />
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
  return (
    <Pressable
      style={[styles.listRow, disabled && styles.listRowDisabled]}
      onPress={onPress}
      disabled={disabled}>
      <MaterialIcons name={icon} size={20} color={danger ? '#fca5a5' : '#cbd5e1'} />
      <Text style={[styles.listLabel, danger && styles.listLabelDanger]}>{label}</Text>
      <View style={styles.listTrailing}>{trailing}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0b1120',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#1f2937',
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', flex: 1 },
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
    backgroundColor: '#0f1e3d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  feedbackText: { color: '#bbf7d0', fontSize: 13, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 8 },
  sectionLabel: {
    color: '#6b7280',
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
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  iconActionLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1f2937', marginVertical: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  listRowDisabled: { opacity: 0.5 },
  listLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '500', flex: 1 },
  listLabelDanger: { color: '#fca5a5' },
  listTrailing: { minWidth: 20, alignItems: 'flex-end' },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  cancelText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
