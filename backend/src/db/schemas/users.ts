// src/db/schemas/users.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  notionUserId: text('notion_user_id').notNull().unique(),
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  notionWorkspaceId: text('notion_workspace_id').notNull(),
  notionWorkspaceName: text('notion_workspace_name'),
  notionBotId: text('notion_bot_id'),
  notionAccessToken: text('notion_access_token').notNull(), // store encrypted
  notionRefreshToken: text('notion_refresh_token'), // store encrypted, nullable
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});