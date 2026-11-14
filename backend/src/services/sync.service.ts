// src/services/sync.service.ts
import { and, eq, inArray, notExists, sql } from 'drizzle-orm';
import { db } from '../db';
import { notionItems, revisionPlans, users } from '../db/schemas';
import { decrypt } from '../lib/crypto';
import { ApiError } from '../utils/apiErrors';
import {
  getBlock,
  getTitle,
  searchAll,
  type NotionParent,
  type NotionSearchItem,
} from './notion.service';

const MAX_BLOCK_HOPS = 10;
const CHUNK_SIZE = 500;

// One sync per student at a time (in memory, so it only covers a single server process)
const running = new Set<string>();

function chunk<T>(list: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
  return parts;
}

// Skip the trash, archived pages and partial objects
function isSyncable(item: NotionSearchItem): boolean {
  if (item.in_trash) return false;
  if (item.object === 'page' && item.is_archived) return false;
  return typeof item.last_edited_time === 'string';
}

// Turns "who is my parent?" into the Notion id of a page or data source (or null = top level).
// When the parent is a block, it looks the block up and keeps walking upwards.
function createParentResolver(
  accessToken: string,
  dataSourceByDatabase: Map<string, string>,
) {
  const blockCache = new Map<string, string | null>();

  async function resolve(parent: NotionParent | undefined, hopsLeft: number): Promise<string | null> {
    if (!parent) return null;

    switch (parent.type) {
      case 'page_id':
        return parent.page_id;
      case 'data_source_id':
        return parent.data_source_id;
      case 'database_id':
        return dataSourceByDatabase.get(parent.database_id) ?? null;
      case 'block_id': {
        if (hopsLeft <= 0) return null;
        const cached = blockCache.get(parent.block_id);
        if (cached !== undefined) return cached;

        let result: string | null = null;
        try {
          const block = await getBlock(accessToken, parent.block_id);
          result = await resolve(block.parent, hopsLeft - 1);
        } catch (err) {
          // Can't read the block: treat the item as top level instead of failing the sync
          console.warn(`[sync] could not resolve block ${parent.block_id}:`, (err as Error).message);
        }
        blockCache.set(parent.block_id, result);
        return result;
      }
      default:
        return null; // workspace or agent
    }
  }

  return (parent: NotionParent | undefined) => resolve(parent, MAX_BLOCK_HOPS);
}

export async function syncItems(userId: string) {
  if (running.has(userId)) throw new ApiError(409, 'A sync is already running');
  running.add(userId);
  try {
    return await runSync(userId);
  } finally {
    running.delete(userId);
  }
}

async function runSync(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(404, 'User not found');

  const accessToken = decrypt(user.notionAccessToken);

  const items = (await searchAll(accessToken)).filter(isSyncable);

  // For parents that are given as a database id: which data source belongs to it
  const dataSourceByDatabase = new Map<string, string>();
  for (const item of items) {
    if (item.object === 'data_source' && item.parent?.type === 'database_id') {
      dataSourceByDatabase.set(item.parent.database_id, item.id);
    }
  }

  // ---- Pass 1: save every item, without parents ----
  const rows = items.map((item) => ({
    userId,
    notionId: item.id,
    type: item.object === 'page' ? ('page' as const) : ('database' as const),
    title: getTitle(item) || (item.object === 'page' ? 'Untitled' : 'Untitled database'),
    notionUrl: item.url ?? null,
    lastEditedTime: new Date(item.last_edited_time),
  }));

  for (const part of chunk(rows, CHUNK_SIZE)) {
    await db
      .insert(notionItems)
      .values(part)
      .onConflictDoUpdate({
        target: [notionItems.userId, notionItems.notionId],
        set: {
          type: sql`excluded.type`,
          title: sql`excluded.title`,
          notionUrl: sql`excluded.notion_url`,
          lastEditedTime: sql`excluded.last_edited_time`,
          updatedAt: new Date(),
        },
      });
  }

  // Our own ids for every row, so pass 2 can link parents
  const existing = await db
    .select({
      id: notionItems.id,
      notionId: notionItems.notionId,
      parentId: notionItems.parentId,
    })
    .from(notionItems)
    .where(eq(notionItems.userId, userId));

  const rowByNotionId = new Map(existing.map((r) => [r.notionId, r]));

  // ---- Pass 2: set parents (only where something changed) ----
  const resolveParent = createParentResolver(accessToken, dataSourceByDatabase);
  const idsByNewParent = new Map<string | null, string[]>();

  for (const item of items) {
    const row = rowByNotionId.get(item.id);
    if (!row) continue;

    // A page's parent is in `parent`; a gallery's location is in `database_parent`
    const parentNotionId = await resolveParent(
      item.object === 'page' ? item.parent : item.database_parent,
    );

    // Parent not shared with us, or not synced: fall back to top level
    const parentRow =
      parentNotionId && parentNotionId !== item.id ? rowByNotionId.get(parentNotionId) : undefined;
    const newParentId = parentRow?.id ?? null;

    if (row.parentId !== newParentId) {
      const group = idsByNewParent.get(newParentId) ?? [];
      group.push(row.id);
      idsByNewParent.set(newParentId, group);
    }
  }

  for (const [parentId, ids] of idsByNewParent) {
    for (const part of chunk(ids, CHUNK_SIZE)) {
      await db.update(notionItems).set({ parentId }).where(inArray(notionItems.id, part));
    }
  }

  // ---- Items that are gone from Notion ----
  let removed = 0;
  let staleKept = 0;

  // An empty result probably means a problem on Notion's side, so don't delete anything then
  if (items.length > 0) {
    const seen = new Set(items.map((i) => i.id));
    const staleIds = existing.filter((r) => !seen.has(r.notionId)).map((r) => r.id);

    for (const part of chunk(staleIds, CHUNK_SIZE)) {
      // Only delete rows nobody selected, so a student's progress is never lost by a sync
      const deleted = await db
        .delete(notionItems)
        .where(
          and(
            inArray(notionItems.id, part),
            notExists(
              db
                .select({ one: sql`1` })
                .from(revisionPlans)
                .where(eq(revisionPlans.itemId, notionItems.id)),
            ),
          ),
        )
        .returning({ id: notionItems.id });
      removed += deleted.length;
    }
    staleKept = staleIds.length - removed;
  }

  return { total: items.length, removed, staleKept };
}