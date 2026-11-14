// src/db/schemas/questions.ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { quizzes } from './quizzes';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(), // order within the quiz
    question: text('question').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    context: text('context').notNull(), // evaluator's reference, never sent to the app
  },
  (table) => [uniqueIndex('questions_quiz_position_unique').on(table.quizId, table.position)],
);