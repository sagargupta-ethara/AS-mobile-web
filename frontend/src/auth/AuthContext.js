import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, saveToken, clearToken, getToken } from "@/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.get("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const resp = await api.post(
      "/auth/login",
      { email: email.trim().toLowerCase(), password },
      false
    );
    saveToken(resp.access_token);
    setUser(resp.user);
    return resp.user;
  }, []);

  const logout = useCallback(async () => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
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
