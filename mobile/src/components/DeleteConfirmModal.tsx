import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const PREF_KEY = 'qbitui_delete_files';

interface Props {
  visible: boolean;
  torrentName?: string;
  count?: number;
  onCancel: () => void;
  onConfirm: (deleteFiles: boolean) => void;
}

export function DeleteConfirmModal({ visible, torrentName, count = 1, onCancel, onConfirm }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem(PREF_KEY)
        .then((val) => setDeleteFiles(val === 'true'))
        .catch(() => {});
    }
  }, [visible]);

  async function handleConfirm() {
    try {
      await AsyncStorage.setItem(PREF_KEY, String(deleteFiles));
    } catch {}
    onConfirm(deleteFiles);
  }

  const isBulk = count > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Delete Torrent{isBulk ? 's' : ''}</Text>
          <Text style={styles.message} numberOfLines={3}>
            {isBulk ? `Remove ${count} torrents?` : `Remove "${torrentName}"?`}
          </Text>

          <Pressable style={styles.checkRow} onPress={() => setDeleteFiles((v) => !v)}>
            <View style={[styles.checkbox, deleteFiles && styles.checkboxOn]}>
              {deleteFiles && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Also delete downloaded files</Text>
          </Pressable>

          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={handleConfirm}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 16,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#4b5563',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: {
    borderColor: '#3b82f6',
    backgroundColor: '#2563eb',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  checkLabel: {
    color: '#d1d5db',
    fontSize: 14,
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  cancelText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 15,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#991b1b',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 15,
  },
});
