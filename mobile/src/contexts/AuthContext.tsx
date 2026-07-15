// AuthProvider — hydrates from SecureStore on mount, exposes user/token/login/logout.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { AUTH_TOKEN_KEY, apiFetch, setOnUnauthorized } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export type UserRole = "admin" | "manager" | "tasker";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_CACHE_KEY = "auth_user";

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(async (): Promise<void> => {
    // Best-effort server logout; ignore failures (token may already be invalid)
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* noop */
    }
    await storage.secureRemove(AUTH_TOKEN_KEY);
    await storage.removeItem(USER_CACHE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  // Install 401 handler
  useEffect(() => {
    setOnUnauthorized(() => {
      void logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  // Hydrate session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await apiFetch<AuthUser>("/api/auth/me");
        if (!cancelled) {
          setToken(stored);
          setUser(me);
          await storage.setItem(USER_CACHE_KEY, JSON.stringify(me));
        }
      } catch {
        // Token expired or invalid — nuke and stay logged out
        await storage.secureRemove(AUTH_TOKEN_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await storage.secureSet(AUTH_TOKEN_KEY, res.access_token);
    await storage.setItem(USER_CACHE_KEY, JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
