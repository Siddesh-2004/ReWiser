// src/db/schemas/quizzes.ts
import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { revisionPlans } from './revision-plans';

export const quizStatus = pgEnum('quiz_status', [
  'pending',
  'in_progress',
  'completed',
]);

export const quizzes = pgTable(
  'quizzes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => revisionPlans.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    difficulty: integer('difficulty').notNull(),
    status: quizStatus('status').notNull().default('pending'),
    sourceEditedTime: timestamp('source_edited_time').notNull(), // page's lastEditedTime when questions were generated
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [uniqueIndex('quizzes_plan_round_unique').on(table.planId, table.round)],
);