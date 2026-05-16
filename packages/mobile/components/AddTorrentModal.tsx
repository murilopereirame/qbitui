import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useUIStore } from "../store";
import { useAddTorrent } from "../hooks/useTorrents";

type Tab = "magnet" | "file";

interface PickedFile {
  uri: string;
  name: string;
}

export function AddTorrentModal() {
  const { isAddModalOpen, setAddModalOpen } = useUIStore();
  const { addMagnet, addFile } = useAddTorrent();

  const [tab, setTab] = useState<Tab>("magnet");
  const [magnetText, setMagnetText] = useState("");
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([]);
  const [savepath, setSavepath] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [paused, setPaused] = useState(false);
  const [magnetError, setMagnetError] = useState("");
  const [fileError, setFileError] = useState("");

  function reset() {
    setTab("magnet");
    setMagnetText("");
    setPickedFiles([]);
    setSavepath("");
    setCategory("");
    setTags("");
    setPaused(false);
    setMagnetError("");
    setFileError("");
  }

  function handleClose() {
    setAddModalOpen(false);
    reset();
  }

  function parseMagnets(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("magnet:"));
  }

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/x-bittorrent",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const newFiles = result.assets
        .filter((a) => a.name.endsWith(".torrent"))
        .map((a) => ({ uri: a.uri, name: a.name }));
      setPickedFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name));
        return [...prev, ...newFiles.filter((f) => !existing.has(f.name))];
      });
    } catch {
      setFileError("Failed to open file picker");
    }
  }

  async function handleAddMagnet() {
    const urls = parseMagnets(magnetText);
    if (urls.length === 0) {
      setMagnetError("No valid magnet links found. Each line should start with magnet:");
      return;
    }
    setMagnetError("");
    addMagnet.mutate(
      { urls, options: { savepath, category, tags, paused } },
      {
        onSuccess: () => handleClose(),
        onError: (e) => setMagnetError(e instanceof Error ? e.message : "Failed to add magnet"),
      }
    );
  }

  async function handleAddFiles() {
    if (pickedFiles.length === 0) return;
    const options = { savepath, category, tags, paused };
    // Add files sequentially
    let errorCount = 0;
    for (const file of pickedFiles) {
      await addFile.mutateAsync({ uri: file.uri, name: file.name, options }).catch(() => {
        errorCount++;
      });
    }
    if (errorCount > 0) {
      setFileError(`${errorCount} file(s) failed to upload`);
    } else {
      handleClose();
    }
  }

  const magnetCount = parseMagnets(magnetText).length;

  const sharedOptions = (
    <View className="gap-3 pt-3 border-t border-white/10">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-gray-400 text-xs mb-1">Save Path</Text>
          <TextInput
            className="bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            placeholder="/downloads"
            placeholderTextColor="#6b7280"
            value={savepath}
            onChangeText={setSavepath}
            autoCapitalize="none"
          />
        </View>
        <View className="flex-1">
          <Text className="text-gray-400 text-xs mb-1">Category</Text>
          <TextInput
            className="bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
            placeholder="movies"
            placeholderTextColor="#6b7280"
            value={category}
            onChangeText={setCategory}
            autoCapitalize="none"
          />
        </View>
      </View>
      <View>
        <Text className="text-gray-400 text-xs mb-1">Tags</Text>
        <TextInput
          className="bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
          placeholder="tag1, tag2"
          placeholderTextColor="#6b7280"
          value={tags}
          onChangeText={setTags}
          autoCapitalize="none"
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-300 text-sm">Add as paused</Text>
        <Switch
          value={paused}
          onValueChange={setPaused}
          trackColor={{ false: "#374151", true: "#2563eb" }}
          thumbColor={Platform.OS === "ios" ? undefined : "white"}
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible={isAddModalOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-gray-900 rounded-t-3xl border-t border-white/10 max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-white text-lg font-semibold">Add Torrent</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text className="text-gray-400 text-2xl leading-none">×</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View className="flex-row mx-5 mb-4 bg-gray-800 rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setTab("magnet")}
              className={`flex-1 py-2 rounded-lg items-center ${tab === "magnet" ? "bg-blue-600" : ""}`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${tab === "magnet" ? "text-white" : "text-gray-400"}`}>
                🔗 Magnet Link
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab("file")}
              className={`flex-1 py-2 rounded-lg items-center ${tab === "file" ? "bg-blue-600" : ""}`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${tab === "file" ? "text-white" : "text-gray-400"}`}>
                📁 Upload File
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5" keyboardShouldPersistTaps="handled">
            {tab === "magnet" ? (
              <View className="gap-3 pb-8">
                <View>
                  <Text className="text-gray-400 text-xs mb-1">Magnet Links</Text>
                  <TextInput
                    className="bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-mono"
                    placeholder={"magnet:?xt=urn:btih:..."}
                    placeholderTextColor="#6b7280"
                    value={magnetText}
                    onChangeText={(t) => { setMagnetText(t); setMagnetError(""); }}
                    multiline
                    numberOfLines={5}
                    style={styles.magnetInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text className="text-gray-600 text-xs mt-1">One magnet link per line</Text>
                  {magnetError ? (
                    <Text className="text-red-400 text-xs mt-1">⚠ {magnetError}</Text>
                  ) : null}
                </View>
                {sharedOptions}
                <TouchableOpacity
                  onPress={handleAddMagnet}
                  disabled={addMagnet.isPending || !magnetText.trim()}
                  className={`py-3.5 rounded-xl items-center mt-2 ${
                    addMagnet.isPending || !magnetText.trim() ? "bg-blue-600/50" : "bg-blue-600"
                  }`}
                  activeOpacity={0.8}
                >
                  {addMagnet.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold">
                      Add {magnetCount > 1 ? `${magnetCount} Magnets` : "Magnet"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-3 pb-8">
                <TouchableOpacity
                  onPress={pickFiles}
                  className="border-2 border-dashed border-white/20 rounded-2xl p-8 items-center gap-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-4xl">📂</Text>
                  <Text className="text-gray-400 text-sm">Tap to pick .torrent files</Text>
                </TouchableOpacity>

                {pickedFiles.length > 0 && (
                  <View className="bg-gray-800 rounded-xl p-3 gap-1.5">
                    <Text className="text-gray-400 text-xs mb-1">
                      Selected files ({pickedFiles.length})
                    </Text>
                    {pickedFiles.map((f, i) => (
                      <View key={i} className="flex-row items-center gap-2">
                        <Text className="text-gray-400 text-xs">📄</Text>
                        <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>
                          {f.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setPickedFiles((prev) => prev.filter((_, j) => j !== i))}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text className="text-gray-500 text-base">×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {fileError ? (
                  <Text className="text-red-400 text-xs">⚠ {fileError}</Text>
                ) : null}

                {sharedOptions}
                <TouchableOpacity
                  onPress={handleAddFiles}
                  disabled={addFile.isPending || pickedFiles.length === 0}
                  className={`py-3.5 rounded-xl items-center mt-2 ${
                    addFile.isPending || pickedFiles.length === 0 ? "bg-blue-600/50" : "bg-blue-600"
                  }`}
                  activeOpacity={0.8}
                >
                  {addFile.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold">
                      Upload {pickedFiles.length > 0 ? `${pickedFiles.length} File${pickedFiles.length > 1 ? "s" : ""}` : "Files"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  magnetInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
});
