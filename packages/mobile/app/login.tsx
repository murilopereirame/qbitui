import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { qbitLogin } from "@qbitui/core";
import { persistSession } from "../hooks/useSession";

export default function LoginScreen() {
  const router = useRouter();
  const [host, setHost] = useState("http://192.168.1.1:8080");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!host.trim() || !username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const sid = await qbitLogin(host.trim(), username.trim(), password);
      await persistSession({ host: host.trim(), sid, username: username.trim() });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-950"
    >
      <ScrollView
        contentContainerClassName="flex-1 items-center justify-center p-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">▶</Text>
          </View>
          <Text className="text-white text-3xl font-bold">qbitUI</Text>
          <Text className="text-gray-400 text-base mt-1">
            Connect to your qBittorrent instance
          </Text>
        </View>

        {/* Card */}
        <View className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 border border-white/10">
          {/* Host */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-1.5">Host URL</Text>
            <TextInput
              className="bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base"
              placeholder="http://192.168.1.1:8080"
              placeholderTextColor="#6b7280"
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Username */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-1.5">Username</Text>
            <TextInput
              className="bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base"
              placeholder="admin"
              placeholderTextColor="#6b7280"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
            />
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-1.5">Password</Text>
            <TextInput
              className="bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base"
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />
          </View>

          {/* Error */}
          {error ? (
            <View className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-blue-600 rounded-xl py-3.5 items-center"
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Note */}
        <Text className="text-gray-600 text-xs text-center mt-6 max-w-xs">
          Your device must be able to reach the qBittorrent host directly (e.g., same local network or a
          publicly accessible URL).
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
