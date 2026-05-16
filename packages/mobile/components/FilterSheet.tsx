import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useTorrents } from "../hooks/useTorrents";
import { useSessionStore } from "../hooks/useSession";
import { useUIStore } from "../store";
import { countByFilter } from "@qbitui/core";
import type { TorrentFilter } from "@qbitui/core";

const NAV_ITEMS: { label: string; filter: TorrentFilter; emoji: string }[] = [
  { label: "All Torrents", filter: "all", emoji: "📋" },
  { label: "Downloading", filter: "downloading", emoji: "⬇️" },
  { label: "Seeding", filter: "seeding", emoji: "⬆️" },
  { label: "Paused", filter: "paused", emoji: "⏸" },
  { label: "Completed", filter: "completed", emoji: "✅" },
  { label: "Error", filter: "error", emoji: "⚠️" },
];

export function FilterSheet() {
  const router = useRouter();
  const { isFilterSheetOpen, setFilterSheetOpen, filter, setFilter } = useUIStore();
  const { data, isError } = useTorrents();
  const clearSession = useSessionStore((s) => s.clearSession);

  const counts = countByFilter(data ?? []);

  async function handleLogout() {
    setFilterSheetOpen(false);
    await clearSession();
    router.replace("/login");
  }

  function selectFilter(f: TorrentFilter) {
    setFilter(f);
    setFilterSheetOpen(false);
  }

  return (
    <Modal
      visible={isFilterSheetOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setFilterSheetOpen(false)}
    >
      <Pressable
        className="flex-1 bg-black/50"
        onPress={() => setFilterSheetOpen(false)}
      >
        <View className="absolute left-0 top-0 bottom-0 w-72 bg-gray-950 border-r border-white/10">
          {/* Logo */}
          <View className="flex-row items-center gap-3 px-4 pt-12 pb-4 border-b border-white/10">
            <View className="w-8 h-8 rounded-lg bg-blue-600 items-center justify-center">
              <Text className="text-white text-sm font-bold">▶</Text>
            </View>
            <Text className="text-white text-xl font-bold">qbitUI</Text>
          </View>

          {/* Nav */}
          <ScrollView className="flex-1 p-2">
            {NAV_ITEMS.map(({ label, filter: f, emoji }) => {
              const active = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => selectFilter(f)}
                  className={`flex-row items-center justify-between px-3 py-3 rounded-xl mb-0.5 ${
                    active ? "bg-blue-600/20" : ""
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Text>{emoji}</Text>
                    <Text className={`text-sm font-medium ${active ? "text-blue-400" : "text-gray-300"}`}>
                      {label}
                    </Text>
                  </View>
                  <View
                    className={`min-w-6 px-1.5 py-0.5 rounded-full items-center ${
                      active ? "bg-blue-600/30" : "bg-white/10"
                    }`}
                  >
                    <Text className={`text-xs ${active ? "text-blue-300" : "text-gray-400"}`}>
                      {counts[f] ?? 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-white/10 gap-2">
            <View className="flex-row items-center gap-2 px-2 py-1">
              <View className={`w-2 h-2 rounded-full ${isError ? "bg-red-400" : "bg-green-400"}`} />
              <Text className={`text-xs ${isError ? "text-red-400" : "text-green-400"}`}>
                {isError ? "Disconnected" : "Connected"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center gap-2 px-2 py-2.5 rounded-xl"
              activeOpacity={0.7}
            >
              <Text className="text-gray-400 text-sm">↪  Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
