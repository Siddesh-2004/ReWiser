// src/services/auth.service.ts
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db';
import { users } from '../db/schemas';
import { requireEnv } from '../lib/env';
import { encrypt } from '../lib/crypto';
import { exchangeCodeForToken } from './notion.service';

const STATE_TTL = '10m';
const SESSION_TTL = '30d';

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}

// ---- Step 1: where to send the student ----

export async function getAuthorizeUrl(): Promise<string> {
  const state = await new SignJWT({ purpose: 'notion_oauth_state' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(jwtKey());

  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.set('client_id', requireEnv('NOTION_CLIENT_ID'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('redirect_uri', requireEnv('NOTION_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

async function verifyState(state: string): Promise<void> {
  const { payload } = await jwtVerify(state, jwtKey(), { algorithms: ['HS256'] });
  if (payload.purpose !== 'notion_oauth_state') {
    throw new Error('Invalid state');
  }
}

// ---- Step 2: Notion sends the student back with a code ----

// src/services/auth.service.ts (replace the whole handleCallback function)
export async function handleCallback(code: string, state: string) {
  await verifyState(state);

  const token = await exchangeCodeForToken(code);

  // Temporary: confirm which owner shape Notion really returns. Safe to log, no secrets.
  console.log('[auth] owner type:', token.owner.type);

  if (token.owner.type !== 'user') {
    throw new Error('Notion did not return a user for this authorization');
  }
  const owner = token.owner.user;

  const values = {
    notionUserId: owner.id,
    name: owner.name ?? null,
    email: owner.person?.email ?? null,
    avatarUrl: owner.avatar_url ?? null,
    notionWorkspaceId: token.workspace_id,
    notionWorkspaceName: token.workspace_name,
    notionBotId: token.bot_id,
    notionAccessToken: encrypt(token.access_token),
    notionRefreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
  };

  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.notionUserId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  const sessionToken = await signSessionToken(user.id);

  // Never return Notion's tokens to the app
  return {
    sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  };
}

// ---- Our own session token ----

async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(jwtKey());
}

// Returns the user id, or throws if the token is invalid or expired
export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ['HS256'] });
  if (payload.purpose !== 'session' || !payload.sub) {
    throw new Error('Invalid session token');
  }
  return payload.sub;
}