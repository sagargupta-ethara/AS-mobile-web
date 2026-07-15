// Fetch wrapper with bearer-token injection + 401 auto-logout.
// Uses SecureStore (native) / AsyncStorage (web) via the shared storage helper.

import { storage } from "@/src/utils/storage";

export const AUTH_TOKEN_KEY = "auth_token";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn("[api] EXPO_PUBLIC_BACKEND_URL is not set — requests will fail");
}

export type ApiError = Error & { status?: number; detail?: unknown };

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean; // default true — attach token if present
  headers?: Record<string, string>;
};

let onUnauthorized: (() => void) | null = null;

export const setOnUnauthorized = (fn: (() => void) | null): void => {
  onUnauthorized = fn;
};

export const apiFetch = async <T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> => {
  const { method = "GET", body, auth = true, headers = {} } = opts;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  if (auth) {
    const token = await storage.secureGet<string>(AUTH_TOKEN_KEY, "");
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && onUnauthorized) {
    onUnauthorized();
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const detail = (parsed as { detail?: unknown } | null)?.detail ?? parsed ?? res.statusText;
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    const err: ApiError = new Error(message);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return parsed as T;
};
