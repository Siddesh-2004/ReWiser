import { API_URL } from './config';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The AuthContext plugs its token getter / logout in here, so this file has no React in it.
const handlers = { getToken: () => null, onUnauthorized: () => {} };
export const configureApi = (h) => Object.assign(handlers, h);

// Anything that calls the LLM can take a while (backend allows 2 tries x 120s).
const LLM_TIMEOUT = 200000;

async function request(method, path, body, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = handlers.getToken();

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 204) return null;

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      // A 401 while we hold a token means it expired; a 401 on /login has no token.
      if (res.status === 401 && token) handlers.onUnauthorized();
      const err = data && data.error;
      throw new ApiError(res.status, (err && err.code) || 'HTTP_ERROR', (err && err.message) || `Request failed (${res.status})`);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond');
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and the API URL.');
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  register: (b) => request('POST', '/api/auth/register', b),
  login: (b) => request('POST', '/api/auth/login', b),

  topics: {
    list: () => request('GET', '/api/topics'),
    get: (id) => request('GET', `/api/topics/${id}`),
    create: (b) => request('POST', '/api/topics', b),
    update: (id, b) => request('PATCH', `/api/topics/${id}`, b),
    remove: (id) => request('DELETE', `/api/topics/${id}`),
  },

  sessions: {
    list: (topicId) => request('GET', `/api/sessions${topicId ? `?topicId=${encodeURIComponent(topicId)}` : ''}`),
    get: (id) => request('GET', `/api/sessions/${id}`),
    start: (b) => request('POST', '/api/sessions', b, { timeoutMs: LLM_TIMEOUT }),
    answer: (id, b) => request('POST', `/api/sessions/${id}/answer`, b, { timeoutMs: LLM_TIMEOUT }),
    end: (id) => request('POST', `/api/sessions/${id}/end`),
  },
};
