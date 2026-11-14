// src/services/plan.service.ts
import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '../db';
import { notionItems, quizzes, revisionPlans } from '../db/schemas';
import { addDays, getRound } from '../config/rounds';
import { ApiError } from '../utils/apiErrors';


type Plan = typeof revisionPlans.$inferSelect;

function toResult(plan: Plan) {
  return {
    itemId: plan.itemId,
    isSelected: plan.isActive,
    currentRound: plan.currentRound,
    dueAt: plan.dueAt,
  };
}

export async function selectItem(userId: string, itemId: string) {
  const [item] = await db
    .select({ id: notionItems.id, type: notionItems.type })
    .from(notionItems)
    .where(and(eq(notionItems.id, itemId), eq(notionItems.userId, userId)))
    .limit(1);

  if (!item) throw new ApiError(404, 'Item not found');
  if (item.type !== 'page') throw new ApiError(400, 'Only pages can be selected');

  // A page is a leaf when no other item has it as its parent
  const [child] = await db
    .select({ id: notionItems.id })
    .from(notionItems)
    .where(eq(notionItems.parentId, item.id))
    .limit(1);
  if (child) throw new ApiError(400, 'Only pages with nothing under them can be selected');

  const now = new Date();

  const [existing] = await db
    .select()
    .from(revisionPlans)
    .where(and(eq(revisionPlans.userId, userId), eq(revisionPlans.itemId, itemId)))
    .limit(1);

  // First time: round 1, due after the first interval
  if (!existing) {
    const [plan] = await db
      .insert(revisionPlans)
      .values({
        userId,
        itemId,
        currentRound: 1,
        dueAt: addDays(now, getRound(1).afterDays),
      })
      .returning();
    return toResult(plan);
  }

  // Already selected: nothing to do
  if (existing.isActive) return toResult(existing);

  // Re-selected: keep the round. If the old due date passed while it was off,
  // start a fresh interval so the quiz doesn't appear as overdue instantly.
  const dueAt =
    existing.dueAt <= now
      ? addDays(now, getRound(existing.currentRound).afterDays)
      : existing.dueAt;

  const [plan] = await db
    .update(revisionPlans)
    .set({ isActive: true, dueAt, updatedAt: now })
    .where(eq(revisionPlans.id, existing.id))
    .returning();
  return toResult(plan);
}

export async function unselectItem(userId: string, itemId: string) {
  const [plan] = await db
    .update(revisionPlans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(revisionPlans.userId, userId), eq(revisionPlans.itemId, itemId)))
    .returning();

  if (!plan) throw new ApiError(404, 'This item is not selected');
  return toResult(plan);
}

// add at the bottom of plan.service.ts
export async function getDuePlans(userId: string) {
  const rows = await db
    .select({
      planId: revisionPlans.id,
      itemId: notionItems.id,
      title: notionItems.title,
      notionUrl: notionItems.notionUrl,
      currentRound: revisionPlans.currentRound,
      dueAt: revisionPlans.dueAt,
    })
    .from(revisionPlans)
    .innerJoin(notionItems, eq(revisionPlans.itemId, notionItems.id))
    .where(
      and(
        eq(revisionPlans.userId, userId),
        eq(revisionPlans.isActive, true),
        lte(revisionPlans.dueAt, new Date()),
      ),
    )
    .orderBy(asc(revisionPlans.dueAt)); // most overdue first

  return rows.map((r) => ({
    ...r,
    difficulty: getRound(r.currentRound).difficulty,
  }));
}

export async function getPlans(userId: string) {
  const rows = await db
    .select({
      planId: revisionPlans.id,
      itemId: notionItems.id,
      title: notionItems.title,
      notionUrl: notionItems.notionUrl,
      currentRound: revisionPlans.currentRound,
      dueAt: revisionPlans.dueAt,
      quizId: quizzes.id,
    })
    .from(revisionPlans)
    .innerJoin(notionItems, eq(revisionPlans.itemId, notionItems.id))
    .leftJoin(
      quizzes,
      and(eq(quizzes.planId, revisionPlans.id), eq(quizzes.round, revisionPlans.currentRound)),
    )
    .where(and(eq(revisionPlans.userId, userId), eq(revisionPlans.isActive, true)))
    .orderBy(asc(revisionPlans.dueAt));

  return rows.map(({ quizId, ...plan }) => ({
    ...plan,
    difficulty: getRound(plan.currentRound).difficulty,
    quizReady: Boolean(quizId),
  }));
}

