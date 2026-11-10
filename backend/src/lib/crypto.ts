// src/lib/crypto.ts
import crypto from 'node:crypto';
import { requireEnv } from './env';

function getKey(): Buffer {
  const key = Buffer.from(requireEnv('ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

// AES-256-GCM. Output format: iv:tag:ciphertext (each base64)
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString('base64')).join(':');
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted value');
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}