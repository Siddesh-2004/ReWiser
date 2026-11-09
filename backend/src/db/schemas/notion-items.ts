// src/db/schemas/notion-items.ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const notionItemType = pgEnum('notion_item_type', ['page', 'database']);

export const notionItems = pgTable(
  'notion_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notionId: text('notion_id').notNull(),
    type: notionItemType('type').notNull(),
    title: text('title').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => notionItems.id, {
      onDelete: 'set null',
    }), // null = top level
    notionUrl: text('notion_url'),
    lastEditedTime: timestamp('last_edited_time').notNull(), // from Notion
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('notion_items_user_notion_unique').on(table.userId, table.notionId),
    index('notion_items_parent_idx').on(table.parentId),
  ],
);