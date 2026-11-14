// src/services/auth.service.ts
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db';
import { users } from '../db/schemas';
import { requireEnv } from '../lib/env';
import { encrypt } from '../lib/crypto';
import { buildAuthorizeUrl, exchangeCodeForToken } from './notion.service';

const STATE_TTL = '10m';
const SESSION_TTL = '30d';

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'));
}

// ---- Step 1: where to send the student ----

export async function getAuthorizeUrl(appRedirect: string): Promise<string> {
  const state = await new SignJWT({ purpose: 'notion_oauth_state', app_redirect: appRedirect })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(jwtKey());

  return buildAuthorizeUrl(state);
}

async function verifyState(state: string) {
  const { payload } = await jwtVerify(state, jwtKey(), { algorithms: ['HS256'] });
  if (payload.purpose !== 'notion_oauth_state') {
    throw new Error('Invalid state');
  }
  return payload;
}

// Where to send the student back to; null if the state is invalid or expired
export async function readStateRedirect(state: string): Promise<string | null> {
  try {
    const payload = await verifyState(state);
    return typeof payload.app_redirect === 'string' ? payload.app_redirect : null;
  } catch {
    return null;
  }
}

// ---- Step 2: Notion sends the student back with a code ----

export async function handleCallback(code: string, state: string) {
  await verifyState(state);

  console.info('[auth] exchanging authorization code with Notion');
  const token = await exchangeCodeForToken(code);
  console.info('[auth] Notion token exchange completed');

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

  console.info('[auth] saving authorized user');
  const [user] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.notionUserId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  console.info('[auth] authorized user saved');

  console.info('[auth] signing app session');
  const sessionToken = await signSessionToken(user.id);
  console.info('[auth] app session signed');

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