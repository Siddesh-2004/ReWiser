import { API_URL } from './config';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// AuthContext plugs the token getter / logout in here, so this file has no React in it.
const handlers = { getToken: () => null, onUnauthorized: () => {} };
export const configureApi = (h) => Object.assign(handlers, h);

async function request(method, path, body, timeoutMs = 30000, multipart = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = handlers.getToken();

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      signal: controller.signal,
    });

    let json = null;
    try {
      json = await res.json();
    } catch {}

    if (!res.ok) {
      if (res.status === 401 && token) handlers.onUnauthorized(); // token expired or revoked
      throw new ApiError(res.status, (json && json.message) || `Request failed (${res.status})`);
    }
    return json ? json.data : null; // unwrap ApiResponse
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError(0, 'The server took too long to respond');
    throw new ApiError(0, 'Cannot reach the server. Check your connection and the API URL.');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, timeoutMs) => request('POST', path, body, timeoutMs),
  postMultipart: (path, body, timeoutMs) => request('POST', path, body, timeoutMs, true),
  put: (path, body, timeoutMs) => request('PUT', path, body, timeoutMs),
  delete: (path) => request('DELETE', path),
};
