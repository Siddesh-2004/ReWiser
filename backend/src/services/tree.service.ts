// src/services/tree.service.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { notionItems, revisionPlans } from '../db/schemas';

export type TreeNode = {
  id: string; // our id, not Notion's
  title: string;
  type: 'page' | 'database'; // database = a gallery, table or board
  notionUrl: string | null;
  isLeaf: boolean; // a page with nothing under it
  isSelectable: boolean; // only leaf pages can be picked for revision
  isSelected: boolean; // has an active revision plan
  children: TreeNode[];
};

export async function getTree(userId: string) {
  const rows = await db
    .select({
      id: notionItems.id,
      parentId: notionItems.parentId,
      type: notionItems.type,
      title: notionItems.title,
      notionUrl: notionItems.notionUrl,
      updatedAt: notionItems.updatedAt,
      planActive: revisionPlans.isActive, // null when the item has no plan
    })
    .from(notionItems)
    .leftJoin(
      revisionPlans,
      and(eq(revisionPlans.itemId, notionItems.id), eq(revisionPlans.userId, userId)),
    )
    .where(eq(notionItems.userId, userId));

  const nodes = new Map<string, TreeNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      title: r.title,
      type: r.type,
      notionUrl: r.notionUrl,
      isLeaf: false,
      isSelectable: false,
      isSelected: r.planActive === true,
      children: [],
    });
  }

  // Link each node to its parent; no parent in our table means top level
  const roots: TreeNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Safety net: a parent loop would hide its items and break JSON output. Notion
  // shouldn't produce one, but if it happens, cut the loop and show the item at top level.
  const visited = new Set<string>();
  const visit = (node: TreeNode) => {
    visited.add(node.id);
    node.children.forEach(visit);
  };
  roots.forEach(visit);

  for (const r of rows) {
    if (visited.has(r.id)) continue;
    console.warn(`[tree] parent loop detected at item ${r.id}`);
    const node = nodes.get(r.id)!;
    const parent = nodes.get(r.parentId!)!;
    parent.children = parent.children.filter((c) => c.id !== node.id);
    roots.push(node);
    visit(node);
  }

  // Sort siblings by title and work out the leaf flags
  const finalize = (node: TreeNode) => {
    node.children.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    node.isLeaf = node.type === 'page' && node.children.length === 0;
    node.isSelectable = node.isLeaf;
    node.children.forEach(finalize);
  };
  roots.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  roots.forEach(finalize);

  // Every row is touched by each sync, so the newest updatedAt is the last sync time
  const lastSyncedAt = rows.length
    ? new Date(Math.max(...rows.map((r) => r.updatedAt.getTime()))).toISOString()
    : null;

  return { tree: roots, totalItems: rows.length, lastSyncedAt };
}