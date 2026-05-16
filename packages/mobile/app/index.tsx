import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSessionStore } from "../hooks/useSession";

/**
 * Root index: redirect to /login or /(tabs) based on stored session.
 */
export default function Index() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);
  const isLoading = useSessionStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (session) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [session, isLoading, router]);

  return (
    <View className="flex-1 items-center justify-center bg-gray-950">
      <ActivityIndicator color="#3b82f6" size="large" />
    </View>
  );
}
