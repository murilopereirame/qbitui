import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTorrents, useTorrentAction } from "../../hooks/useTorrents";
import { useTransfer } from "../../hooks/useTransfer";
import { useUIStore } from "../../store";
import { TorrentItem } from "../../components/TorrentItem";
import { AddTorrentModal } from "../../components/AddTorrentModal";
import { FilterSheet } from "../../components/FilterSheet";
import { formatSpeed } from "@qbitui/core";
import type { Torrent } from "@qbitui/core";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { filteredTorrents, isLoading, isError, error } = useTorrents();
  const { data: transfer } = useTransfer();
  const { search, setSearch, selectedHashes, clearSelection, setAddModalOpen, setFilterSheetOpen } =
    useUIStore();
  const { mutate: action } = useTorrentAction();

  function bulkAction(act: "pause" | "resume" | "delete") {
    const hashes = Array.from(selectedHashes);
    action(
      { action: act, hashes, deleteFiles: act === "delete" ? false : undefined },
      { onSuccess: () => clearSelection() }
    );
  }

  function renderItem({ item }: { item: Torrent }) {
    return <TorrentItem torrent={item} />;
  }

  function keyExtractor(item: Torrent) {
    return item.hash;
  }

  return (
    <View className="flex-1 bg-gray-950" style={{ paddingTop: isTablet ? 0 : insets.top }}>
      {/* Top bar */}
      <View className="flex-row items-center gap-2 px-4 py-3 border-b border-white/10 bg-gray-950/50">
        {/* Filter button (phone only) */}
        {!isTablet && (
          <TouchableOpacity
            onPress={() => setFilterSheetOpen(true)}
            className="w-9 h-9 rounded-xl bg-white/5 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-gray-400 text-lg">☰</Text>
          </TouchableOpacity>
        )}

        {/* Search */}
        <View className="flex-1 flex-row items-center bg-gray-800 rounded-xl px-3 py-2 border border-white/10">
          <Text className="text-gray-500 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search torrents…"
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Speeds */}
        <View className="flex-row items-center gap-2">
          <Text className="text-blue-400 text-xs font-mono">
            ↓ {transfer ? formatSpeed(transfer.dl_info_speed) : "—"}
          </Text>
          <Text className="text-green-400 text-xs font-mono">
            ↑ {transfer ? formatSpeed(transfer.up_info_speed) : "—"}
          </Text>
        </View>

        {/* Add button */}
        <TouchableOpacity
          onPress={() => setAddModalOpen(true)}
          className="w-9 h-9 rounded-xl bg-blue-600 items-center justify-center"
          activeOpacity={0.8}
        >
          <Text className="text-white text-xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {/* Bulk action bar */}
      {selectedHashes.size > 0 && (
        <View className="flex-row items-center gap-2 px-4 py-2 bg-blue-600/10 border-b border-blue-600/20">
          <Text className="text-blue-300 text-sm font-medium mr-1">
            {selectedHashes.size} selected
          </Text>
          <TouchableOpacity
            onPress={() => bulkAction("resume")}
            className="bg-white/10 rounded-lg px-3 py-1.5"
            activeOpacity={0.7}
          >
            <Text className="text-white text-xs">▶ Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => bulkAction("pause")}
            className="bg-white/10 rounded-lg px-3 py-1.5"
            activeOpacity={0.7}
          >
            <Text className="text-white text-xs">⏸ Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => bulkAction("delete")}
            className="bg-red-500/20 rounded-lg px-3 py-1.5"
            activeOpacity={0.7}
          >
            <Text className="text-red-400 text-xs">🗑 Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearSelection} className="ml-auto" activeOpacity={0.7}>
            <Text className="text-gray-400 text-xs">Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {isError ? (
        <View className="flex-1 items-center justify-center gap-3 p-8">
          <Text className="text-red-400 font-medium text-base">Failed to load torrents</Text>
          <Text className="text-gray-500 text-sm text-center">
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3b82f6" size="large" />
        </View>
      ) : filteredTorrents.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3">
          <Text className="text-gray-500 text-base">No torrents found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTorrents}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ItemSeparatorComponent={() => <View className="h-px bg-white/5" />}
        />
      )}

      {/* Footer */}
      <View
        className="px-4 py-2 border-t border-white/10"
        style={{ paddingBottom: isTablet ? 8 : insets.bottom }}
      >
        <Text className="text-gray-500 text-xs">
          {filteredTorrents.length} torrent{filteredTorrents.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Modals */}
      <AddTorrentModal />
      <FilterSheet />
    </View>
  );
}
