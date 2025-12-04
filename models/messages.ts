import { mysqlTable, int, text, varchar, timestamp } from 'drizzle-orm/mysql-core';
import { chats } from './chats';

export const messages = mysqlTable('messages', {
    id: int('id').primaryKey().autoincrement(),
    chatId: int('chat_id').references(() => chats.id).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // 'user' or 'assistant'
    content: text('content').notNull(),
    chartSpec: text('chart_spec'),
    createdAt: timestamp('created_at').defaultNow(),
});
