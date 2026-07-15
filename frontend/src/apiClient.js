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

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
