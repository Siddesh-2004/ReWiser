// src/services/content.service.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { notionItems, users } from '../db/schemas';
import { decrypt } from '../lib/crypto';
import { blocksToMarkdown } from '../lib/notion-markdown';
import { ApiError } from '../utils/apiErrors';
import { getBlockTree } from './notion.service';

// Fetches a note's text from Notion, ready to send to the FastAPI server
export async function getNoteContent(userId: string, itemId: string) {
  const [item] = await db
    .select({ notionId: notionItems.notionId, type: notionItems.type, title: notionItems.title })
    .from(notionItems)
    .where(and(eq(notionItems.id, itemId), eq(notionItems.userId, userId)))
    .limit(1);

  if (!item) throw new ApiError(404, 'Item not found');
  if (item.type !== 'page') throw new ApiError(400, 'Only pages have content');

  const [user] = await db
    .select({ token: users.notionAccessToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new ApiError(401, 'User not found');

  const blocks = await getBlockTree(decrypt(user.token), item.notionId);
  const content = blocksToMarkdown(blocks);

  return { title: item.title || 'Untitled', content, length: content.length };
}