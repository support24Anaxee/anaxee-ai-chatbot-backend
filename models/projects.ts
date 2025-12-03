import { mysqlTable, int, varchar, timestamp, json, text } from 'drizzle-orm/mysql-core';

export const projects = mysqlTable('projects', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    scriptName: varchar('script_name', { length: 255 }).notNull(),
    tables: json('tables').$type<string[]>(),
    businessRule: text('business_rule'),
    dbConfig: json('db_config').$type<{
        host: string;
        user: string;
        password: string;
        database: string;
        port?: number;
    }>(),
    createdAt: timestamp('created_at').defaultNow(),
});
