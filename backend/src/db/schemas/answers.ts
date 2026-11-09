// src/db/schemas/answers.ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  timestamp,
} from 'drizzle-orm/pg-core';
import { questions } from './questions';

export const answerMode = pgEnum('answer_mode', ['audio', 'text']);

export const answers = pgTable('answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id')
    .notNull()
    .unique()
    .references(() => questions.id, { onDelete: 'cascade' }),
  mode: answerMode('mode').notNull(),
  transcript: text('transcript').notNull(), // heard (audio) or typed (text)
  correctnessScore: real('correctness_score').notNull(),
  fluencyScore: real('fluency_score'), // null for text answers
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});