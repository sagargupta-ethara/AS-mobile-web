import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";

import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

const AuthGate = ({ children }: { children: React.ReactNode }): React.ReactElement | null => {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const inAuthArea = first === "login";
    if (!user && !inAuthArea) {
      router.replace("/login");
    } else if (user && (inAuthArea || first === undefined)) {
      router.replace("/home");
    }
  }, [user, loading, segments, router]);

  if (loading) return null;
  return <>{children}</>;
};

export default function RootLayout(): React.ReactElement | null {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0c0c0c" } }} />
      </AuthGate>
    </AuthProvider>
  );
}
