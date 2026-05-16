import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTorrents, useTransferInfo } from '../hooks/useTorrents';
import { TorrentItem } from '../components/TorrentItem';
import { useTorrentStore } from '../store/torrentStore';
import { useAuthStore } from '../store/authStore';
import { formatSpeed } from '@qbitui/core';
import type { Torrent } from '@qbitui/core';

type Props = NativeStackScreenProps<RootStackParamList, 'TorrentList'>;

export function TorrentListScreen({ navigation }: Props) {
  const { filter, search, setSearch } = useTorrentStore();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: torrents, isLoading, refetch, isRefetching } = useTorrents(filter);
  const { data: transferInfo } = useTransferInfo();

  const filtered = (torrents ?? []).filter((t: Torrent) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogout = useCallback(() => clearAuth(), [clearAuth]);

  return (
    <View style={styles.container}>
      {transferInfo && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>↓ {formatSpeed(transferInfo.dl_info_speed)}</Text>
          <Text style={styles.bannerText}>↑ {formatSpeed(transferInfo.up_info_speed)}</Text>
        </View>
      )}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search torrents…"
          placeholderTextColor="#6b7280"
        />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563eb" size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.hash}
          renderItem={({ item }) => (
            <TorrentItem
              torrent={item}
              onPress={() => navigation.navigate('TorrentDetail', { hash: item.hash, name: item.name })}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          ListEmptyComponent={<Text style={styles.empty}>No torrents</Text>}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  banner: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#111827', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  bannerText: { color: '#9ca3af', fontSize: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 14 },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  logoutText: { color: '#ef4444', fontSize: 14 },
  loader: { flex: 1 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 48, fontSize: 16 },
});
