// src/services/notion.service.ts
import { requireEnv } from '../lib/env';

const NOTION_API = 'https://api.notion.com';
const NOTION_VERSION = '2026-03-11'; // newest version seen in the docs; pin it so responses don't change under us

// ---------- Login (OAuth) ----------

export type NotionTokenResponse = {
  access_token: string;
  token_type: 'bearer';
  refresh_token: string | null;
  bot_id: string | null;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  owner:
    | {
        type: 'user';
        user: {
          object: 'user';
          id: string;
          name?: string | null; // missing when Notion returns a partial user
          avatar_url?: string | null; // missing when Notion returns a partial user
          person?: { email?: string };
        };
      }
    | { type: 'workspace'; workspace: true };
  duplicated_template_id: string | null;
  request_id: string;
};

// Where to send the student to approve access
export function buildAuthorizeUrl(state: string): string {
  const url = new URL(`${NOTION_API}/v1/oauth/authorize`);
  url.searchParams.set('client_id', requireEnv('NOTION_CLIENT_ID'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('redirect_uri', requireEnv('NOTION_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

// Trade the one-time code from the callback for the student's tokens
export async function exchangeCodeForToken(code: string): Promise<NotionTokenResponse> {
  const clientId = requireEnv('NOTION_CLIENT_ID');
  const clientSecret = requireEnv('NOTION_CLIENT_SECRET');
  const redirectUri = requireEnv('NOTION_REDIRECT_URI');

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${NOTION_API}/v1/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      `Notion token exchange failed (${res.status}): ${body?.message ?? 'unknown error'}`,
    );
  }

  return (await res.json()) as NotionTokenResponse;
}

// ---------- Reading the workspace ----------

export type NotionParent =
  | { type: 'workspace'; workspace: true }
  | { type: 'page_id'; page_id: string }
  | { type: 'block_id'; block_id: string }
  | { type: 'database_id'; database_id: string }
  | { type: 'data_source_id'; data_source_id: string; database_id: string }
  | { type: 'agent_id'; agent_id: string };

type NotionRichText = { plain_text: string };

export type NotionPage = {
  object: 'page';
  id: string;
  url: string;
  last_edited_time: string;
  in_trash: boolean;
  is_archived: boolean;
  parent: NotionParent;
  properties: Record<string, { type: string; title?: NotionRichText[] }>;
};

// A gallery, table or board. Its cards are pages whose parent is this data source.
export type NotionDataSource = {
  object: 'data_source';
  id: string;
  url: string;
  last_edited_time: string;
  in_trash: boolean;
  title: NotionRichText[];
  parent: NotionParent; // the database
  database_parent: NotionParent; // where the database sits: a page, a block or the workspace
};

export type NotionSearchItem = NotionPage | NotionDataSource;

export type NotionBlock = {
  object: 'block';
  id: string;
  type: string;
  has_children: boolean;
  parent: NotionParent;
};

export type NotionContentBlock = {
  object: 'block';
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionContentBlock[];
  parent?: NotionParent;
  [key: string]: any;
};

type NotionList<T> = {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

async function notionRequest<T>(
  accessToken: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Rate limited: wait as long as Notion asks, then try again
    if (res.status === 429) {
      const waitSeconds = Number(res.headers.get('retry-after') ?? 1);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        `Notion ${method} ${path} failed (${res.status}): ${json?.code ?? 'unknown'} ${json?.message ?? ''}`.trim(),
      );
    }
    return json as T;
  }
  throw new Error(`Notion ${method} ${path} was rate limited too many times`);
}

// Everything the student shared: pages and data sources, all pages of results
export async function searchAll(accessToken: string): Promise<NotionSearchItem[]> {
  const items: NotionSearchItem[] = [];
  let cursor: string | undefined;

  do {
    const page = await notionRequest<NotionList<NotionSearchItem>>(
      accessToken,
      'POST',
      '/v1/search',
      { page_size: 100, start_cursor: cursor },
    );
    items.push(...page.results);
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor);

  return items;
}

// One block, used to walk up when an item's parent is a block
export async function getBlock(accessToken: string, blockId: string): Promise<NotionBlock> {
  return notionRequest<NotionBlock>(accessToken, 'GET', `/v1/blocks/${blockId}`);
}

// Recursively fetch a page's child blocks, including nested containers.
export async function getBlockTree(accessToken: string, blockId: string): Promise<NotionContentBlock[]> {
  const results: NotionContentBlock[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);

    const page = await notionRequest<NotionList<NotionContentBlock>>(
      accessToken,
      'GET',
      `/v1/blocks/${blockId}/children?${params.toString()}`,
    );
    results.push(...(page.results ?? []));
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor);

  for (const block of results) {
    if (block.has_children) {
      block.children = await getBlockTree(accessToken, block.id);
    }
  }

  return results;
}

// Title of a page or data source; empty string if it has none
export function getTitle(item: NotionSearchItem): string {
  if (item.object === 'data_source') {
    return item.title.map((t) => t.plain_text).join('').trim();
  }
  const titleProp = Object.values(item.properties).find((p) => p.type === 'title');
  return (titleProp?.title ?? []).map((t) => t.plain_text).join('').trim();
}