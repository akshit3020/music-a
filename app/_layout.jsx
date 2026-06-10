import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initDB } from "../lib/db";
import { useLibraryStore } from "../store/useLibraryStore";
import "./global.css";

export default function RootLayout() {
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  useEffect(() => {
    initDB();
    loadLibrary();
  }, []);
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
