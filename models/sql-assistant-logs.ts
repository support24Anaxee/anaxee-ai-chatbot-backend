import { mysqlTable, int, text, varchar, timestamp, json, decimal } from 'drizzle-orm/mysql-core';
import { chats } from './chats';
import { projects } from './projects';

export const sqlAssistantLogs = mysqlTable('sql_assistant_logs', {
    id: int('id').primaryKey().autoincrement(),
    chatId: int('chat_id').references(() => chats.id),
    projectId: int('project_id').references(() => projects.id).notNull(),
    userMessage: text('user_message').notNull(),
    generatedSql: text('generated_sql'),
    executionTimeMs: int('execution_time_ms'), // Total execution time in milliseconds
    schemaFetchTimeMs: int('schema_fetch_time_ms'), // Time to fetch schema
    sqlGenerationTimeMs: int('sql_generation_time_ms'), // Time to generate SQL
    queryExecutionTimeMs: int('query_execution_time_ms'), // Time to execute SQL query
    responseGenerationTimeMs: int('response_generation_time_ms'), // Time to generate response
    rowCount: int('row_count'), // Number of rows returned
    tokenUsage: json('token_usage').$type<{
        promptTokens?: number;
        candidatesTokens?: number;
        totalTokens?: number;
        cachedContentTokens?: number;
    }>(),
    status: varchar('status', { length: 50 }).notNull().default('success'), // 'success', 'error', 'no_data'
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
});
