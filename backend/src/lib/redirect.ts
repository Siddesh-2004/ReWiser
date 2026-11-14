// src/lib/redirect.ts
import { requireEnv } from './env';

// localhost and private network ranges: the only hosts Expo Go's dev server can be on
const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function isAllowedAppRedirect(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // Production and development builds
  if (url.protocol === `${requireEnv('APP_SCHEME')}:`) return true;

  // Expo Go, development only
  if (process.env.NODE_ENV !== 'production' && url.protocol === 'exp:') {
    return PRIVATE_HOST.test(url.hostname);
  }

  // Expo web, development only
  if (process.env.NODE_ENV !== 'production' && url.protocol === 'http:') {
    return PRIVATE_HOST.test(url.hostname);
  }

  return false;
}

// Adds query parameters to the app's return URL
export function withParams(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}