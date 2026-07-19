import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, saveToken, clearToken, scheduleTokenRefresh, refreshIfExpiringSoon, User } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import { AppState, AppStateStatus } from "react-native";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.secureGet("scindia_token", "");
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.get<User>("/auth/me");
      setUser(me);
      scheduleTokenRefresh(token);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  /* On foreground, refresh token if it expires within 10 minutes */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        refreshIfExpiringSoon();
      }
    });
    return () => sub.remove();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await api.post<{ access_token: string; user: User }>(
      "/auth/login",
      { email: email.trim().toLowerCase(), password },
      false
    );
    await saveToken(resp.access_token);
    scheduleTokenRefresh(resp.access_token);
    setUser(resp.user);
    return resp.user;
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAuthed: !!user, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
