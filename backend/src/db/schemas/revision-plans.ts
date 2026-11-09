// src/db/schemas/revision-plans.ts
import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { notionItems } from './notion-items';

export const revisionPlans = pgTable(
  'revision_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => notionItems.id, { onDelete: 'cascade' }),
    currentRound: integer('current_round').notNull().default(1),
    dueAt: timestamp('due_at').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('revision_plans_user_item_unique').on(table.userId, table.itemId),
    index('revision_plans_due_idx').on(table.userId, table.isActive, table.dueAt),
  ],
);