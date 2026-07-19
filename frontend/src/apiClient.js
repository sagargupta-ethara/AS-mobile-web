import { jwtDecode } from "jwt-decode";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "scindia_token";

/* ---------- 401 auto-logout event bus ---------- */
const AUTH_LOGOUT_EVENT = "auth:logout";
export function onAuthLogout(cb) {
  window.addEventListener(AUTH_LOGOUT_EVENT, cb);
  return () => window.removeEventListener(AUTH_LOGOUT_EVENT, cb);
}
function emitLogout() {
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

/* ---------- silent-refresh scheduler ---------- */
const REFRESH_LEAD_MS = 5 * 60 * 1000; // fire 5 minutes before expiry
const MAX_TIMEOUT_MS = 2_147_483_000; // stay under int32 setTimeout limit
let refreshTimer = null;

function decodeExp(token) {
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function cancelTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export function scheduleTokenRefresh(token) {
  cancelTokenRefresh();
  if (!token) return;
  const expMs = decodeExp(token);
  if (!expMs) return;
  const raw = expMs - Date.now() - REFRESH_LEAD_MS;
  const delay = Math.min(Math.max(raw, 5_000), MAX_TIMEOUT_MS);
  refreshTimer = setTimeout(async () => {
    try {
      const resp = await request("POST", "/auth/refresh", null, true);
      if (resp && resp.access_token) {
        saveToken(resp.access_token);
        scheduleTokenRefresh(resp.access_token);
      }
    } catch {
      // request() already handled 401 by clearing token + emitting logout
    }
  }, delay);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  cancelTokenRefresh();
}

async function request(method, path, body, auth = true) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(`${BACKEND}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 204) return undefined;
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!resp.ok) {
    if (resp.status === 401) {
      clearToken();
      emitLogout();
    }
    const msg =
      (data && (data.detail || data.message)) ||
      `Request failed (${resp.status})`;
    const error = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    error.status = resp.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body, auth = true) => request("POST", path, body, auth),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
};
