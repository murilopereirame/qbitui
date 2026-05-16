import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import {
  Torrent,
  formatBytes,
  formatSpeed,
  formatETA,
  formatRatio,
  getStateLabel,
  getStateColorVariant,
} from "@qbitui/core";
import { useTorrentAction } from "../hooks/useTorrents";
import { useUIStore } from "../store";
import type { StateColorVariant } from "@qbitui/core";

interface TorrentItemProps {
  torrent: Torrent;
}

const variantStyles: Record<StateColorVariant, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  gray: { bg: "bg-gray-500/20", text: "text-gray-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

export function TorrentItem({ torrent }: TorrentItemProps) {
  const { selectedHashes, toggleSelection } = useUIStore();
  const { mutate: action } = useTorrentAction();
  const isSelected = selectedHashes.has(torrent.hash);
  const [menuVisible, setMenuVisible] = useState(false);

  const colorVariant = getStateColorVariant(torrent.state);
  const { bg, text } = variantStyles[colorVariant];
  const isPaused = torrent.state === "pausedDL" || torrent.state === "pausedUP";

  function doAction(act: "pause" | "resume" | "delete" | "recheck" | "reannounce", deleteFiles?: boolean) {
    setMenuVisible(false);
    action({ action: act, hashes: [torrent.hash], deleteFiles });
  }

  const progressPct = Math.round(torrent.progress * 100);

  return (
    <TouchableOpacity
      onPress={() => toggleSelection(torrent.hash)}
      onLongPress={() => setMenuVisible(true)}
      activeOpacity={0.7}
      className={`px-4 py-3 ${isSelected ? "bg-blue-600/10" : ""}`}
    >
      {/* Row 1: name + state badge + menu */}
      <View className="flex-row items-start gap-2 mb-1.5">
        {/* Selection indicator */}
        <View
          className={`w-4 h-4 rounded border mt-0.5 shrink-0 items-center justify-center ${
            isSelected ? "bg-blue-600 border-blue-600" : "border-gray-600"
          }`}
        >
          {isSelected && <Text className="text-white text-xs leading-none">✓</Text>}
        </View>

        {/* Name */}
        <Text className="text-white text-sm font-medium flex-1" numberOfLines={1}>
          {torrent.name}
        </Text>

        {/* State badge */}
        <View className={`px-2 py-0.5 rounded-full ${bg}`}>
          <Text className={`text-xs font-medium ${text}`}>{getStateLabel(torrent.state)}</Text>
        </View>

        {/* Menu button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-gray-500 text-lg leading-none">⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View className="ml-6 mb-1.5">
        <View className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <View
            className={`h-full rounded-full ${
              torrent.state === "error" || torrent.state === "missingFiles"
                ? "bg-red-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </View>
      </View>

      {/* Row 2: stats */}
      <View className="ml-6 flex-row flex-wrap gap-x-3 gap-y-0.5">
        <Text className="text-gray-500 text-xs">{progressPct}%</Text>
        <Text className="text-gray-500 text-xs">{formatBytes(torrent.size)}</Text>
        {torrent.dlspeed > 0 && (
          <Text className="text-blue-400 text-xs">↓ {formatSpeed(torrent.dlspeed)}</Text>
        )}
        {torrent.upspeed > 0 && (
          <Text className="text-green-400 text-xs">↑ {formatSpeed(torrent.upspeed)}</Text>
        )}
        {torrent.eta > 0 && torrent.eta !== 8640000 && (
          <Text className="text-gray-400 text-xs">ETA {formatETA(torrent.eta)}</Text>
        )}
        <Text className="text-gray-500 text-xs">
          {torrent.num_seeds}↑/{torrent.num_leechs}↓
        </Text>
        <Text className="text-gray-500 text-xs">R: {formatRatio(torrent.ratio)}</Text>
        {torrent.category ? (
          <View className="bg-purple-500/20 px-1.5 rounded-full">
            <Text className="text-purple-300 text-xs">{torrent.category}</Text>
          </View>
        ) : null}
      </View>

      {/* Context menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center"
          onPress={() => setMenuVisible(false)}
        >
          <View className="bg-gray-900 rounded-2xl overflow-hidden border border-white/10 w-64">
            <Text className="text-gray-400 text-xs px-4 py-3 border-b border-white/10" numberOfLines={1}>
              {torrent.name}
            </Text>

            {isPaused ? (
              <TouchableOpacity onPress={() => doAction("resume")} className="px-4 py-3.5">
                <Text className="text-green-400">▶ Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => doAction("pause")} className="px-4 py-3.5">
                <Text className="text-yellow-400">⏸ Pause</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => doAction("recheck")}
              className="px-4 py-3.5 border-t border-white/5"
            >
              <Text className="text-blue-400">↻ Recheck</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => doAction("reannounce")}
              className="px-4 py-3.5 border-t border-white/5"
            >
              <Text className="text-purple-400">📡 Reannounce</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => doAction("delete", false)}
              className="px-4 py-3.5 border-t border-white/10"
            >
              <Text className="text-red-400">🗑 Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => doAction("delete", true)}
              className="px-4 py-3.5 border-t border-white/5"
            >
              <Text className="text-red-400">🗑 Delete + Files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMenuVisible(false)}
              className="px-4 py-3.5 border-t border-white/10"
            >
              <Text className="text-gray-400 text-center">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
}
