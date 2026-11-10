// scripts/explore-notion.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schemas';
import { decrypt } from '../src/lib/crypto';

const NOTION_API = 'https://api.notion.com';
const NOTION_VERSION = '2026-03-11';
const OUT_DIR = path.join(process.cwd(), 'tmp', 'notion-explore');

type Json = any;

async function getAccessToken(): Promise<string> {
  const email = process.env.EXPLORE_EMAIL; // optional: pick a user by email
  const rows = email
    ? await db.select().from(users).where(eq(users.email, email)).limit(1)
    : await db.select().from(users).limit(1);
  if (!rows[0]) throw new Error('No user found. Log in through /auth/notion first.');
  return decrypt(rows[0].notionAccessToken);
}

async function notion(
  token: string,
  method: 'GET' | 'POST',
  apiPath: string,
  body?: unknown,
): Promise<Json> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${NOTION_API}${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 1);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Notion ${method} ${apiPath} failed (${res.status}): ${json?.code} ${json?.message}`);
    }
    return json;
  }
  throw new Error('Rate limited too many times');
}

async function paginate(fetchPage: (cursor?: string) => Promise<Json>): Promise<Json[]> {
  const all: Json[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    all.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return all;
}

function save(name: string, data: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Raw JSON saved to ${file}`);
}

function titleOf(item: Json): string {
  if (item.object === 'page') {
    const prop = Object.values<Json>(item.properties ?? {}).find((p) => p.type === 'title');
    return (prop?.title ?? []).map((t: Json) => t.plain_text).join('') || '(untitled)';
  }
  return (item.title ?? []).map((t: Json) => t.plain_text).join('') || '(untitled)';
}

function parentOf(parent: Json | undefined): string {
  if (!parent) return '-';
  switch (parent.type) {
    case 'workspace':
      return 'workspace';
    case 'page_id':
      return `page ${parent.page_id}`;
    case 'block_id':
      return `block ${parent.block_id}`;
    case 'database_id':
      return `database ${parent.database_id}`;
    case 'data_source_id':
      return `data_source ${parent.data_source_id} (database ${parent.database_id})`;
    default:
      return parent.type;
  }
}

async function searchAll(token: string) {
  const results = await paginate((cursor) =>
    notion(token, 'POST', '/v1/search', { page_size: 100, start_cursor: cursor }),
  );
  save('search', results);

  console.log(`\n${results.length} items from search\n`);
  console.table(
    results.map((r) => ({
      object: r.object,
      title: titleOf(r),
      id: r.id,
      parent: parentOf(r.parent),
      // only data sources have this: where their database sits
      database_parent: r.object === 'data_source' ? parentOf(r.database_parent) : '',
      edited: r.last_edited_time,
    })),
  );
}

async function blocksOf(token: string, id: string) {
  const blocks = await paginate((cursor) =>
    notion(
      token,
      'GET',
      `/v1/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
    ),
  );
  save(`blocks-${id}`, blocks);

  console.log(`\n${blocks.length} child blocks of ${id}\n`);
  console.table(
    blocks.map((b) => {
      const body = b[b.type] ?? {};
      const text =
        (body.rich_text ?? []).map((t: Json) => t.plain_text).join('') || body.title || '';
      return {
        type: b.type,
        has_children: b.has_children,
        id: b.id,
        text: String(text).slice(0, 50),
      };
    }),
  );
}

async function queryDataSource(token: string, id: string) {
  const rows = await paginate((cursor) =>
    notion(token, 'POST', `/v1/data_sources/${id}/query`, {
      page_size: 100,
      start_cursor: cursor,
    }),
  );
  save(`datasource-${id}`, rows);

  console.log(`\n${rows.length} rows in data source ${id}\n`);
  console.table(
    rows.map((r) => ({
      object: r.object,
      title: titleOf(r),
      id: r.id,
      parent: parentOf(r.parent),
      edited: r.last_edited_time,
    })),
  );
}
async function blockInfo(token: string, id: string) {
  const block = await notion(token, 'GET', `/v1/blocks/${id}`);
  save(`block-${id}`, block);
  console.log(`\nblock ${id}`);
  console.log('type:', block.type, '| has_children:', block.has_children);
  console.log('parent:', parentOf(block.parent));
}

async function main() {
  const [mode = 'search', id] = process.argv.slice(2);
  const token = await getAccessToken();

  if (mode === 'search') return searchAll(token);
  if (mode === 'blocks' && id) return blocksOf(token, id);
  if (mode === 'ds' && id) return queryDataSource(token, id);
  // in main(), next to the other modes:
  if (mode === 'block' && id) return blockInfo(token, id);
  console.log('Usage: tsx scripts/explore-notion.ts [search | blocks <id> | ds <dataSourceId>]');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });