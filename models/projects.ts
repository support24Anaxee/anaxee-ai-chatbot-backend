import { mysqlTable, int, varchar, timestamp } from 'drizzle-orm/mysql-core';

export const projects = mysqlTable('projects', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    scriptName: varchar('script_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});
