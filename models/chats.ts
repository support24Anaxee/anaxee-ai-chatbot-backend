import { mysqlTable, int, varchar, timestamp } from 'drizzle-orm/mysql-core';
import { users } from './users';
import { projects } from './projects';
import { usersClient } from './users.client';

export const chats = mysqlTable('chats', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').references(() => usersClient.id).notNull(),
    projectId: int('project_id').references(() => projects.id).notNull(),
    topic: varchar('topic', { length: 255 }).default('new chat'),
    createdAt: timestamp('created_at').defaultNow(),
});
