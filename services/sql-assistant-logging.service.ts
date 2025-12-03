import { db } from '../config/db.config';
import { sqlAssistantLogs } from '../models/sql-assistant-logs';

/**
 * SQL Assistant Logging Service
 */

export interface LogEntry {
    chatId?: number;
    projectId: number;
    userMessage: string;
    generatedSql?: string;
    executionTimeMs?: number;
    schemaFetchTimeMs?: number;
    sqlGenerationTimeMs?: number;
    queryExecutionTimeMs?: number;
    responseGenerationTimeMs?: number;
    rowCount?: number;
    tokenUsage?: {
        promptTokens?: number;
        candidatesTokens?: number;
        totalTokens?: number;
        cachedContentTokens?: number;
    };
    status: 'success' | 'error' | 'no_data';
    errorMessage?: string;
}

/**
 * Create a new SQL assistant log entry
 */
export const createLog = async (entry: LogEntry) => {
    try {
        const [result] = await db.insert(sqlAssistantLogs).values({
            chatId: entry.chatId,
            projectId: entry.projectId,
            userMessage: entry.userMessage,
            generatedSql: entry.generatedSql,
            executionTimeMs: entry.executionTimeMs,
            schemaFetchTimeMs: entry.schemaFetchTimeMs,
            sqlGenerationTimeMs: entry.sqlGenerationTimeMs,
            queryExecutionTimeMs: entry.queryExecutionTimeMs,
            responseGenerationTimeMs: entry.responseGenerationTimeMs,
            rowCount: entry.rowCount,
            tokenUsage: entry.tokenUsage,
            status: entry.status,
            errorMessage: entry.errorMessage,
        }).$returningId();

        return result.id;
    } catch (error) {
        console.error('Error creating SQL assistant log:', error);
        throw error;
    }
};

/**
 * Get logs for a specific project
 */
export const getLogsByProject = async (projectId: number, limit: number = 100) => {
    try {
        return await db
            .select()
            .from(sqlAssistantLogs)
            .where(eq(sqlAssistantLogs.projectId, projectId))
            .orderBy(desc(sqlAssistantLogs.createdAt))
            .limit(limit);
    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
};

/**
 * Get logs for a specific chat
 */
export const getLogsByChat = async (chatId: number) => {
    try {
        return await db
            .select()
            .from(sqlAssistantLogs)
            .where(eq(sqlAssistantLogs.chatId, chatId))
            .orderBy(sqlAssistantLogs.createdAt);
    } catch (error) {
        console.error('Error fetching chat logs:', error);
        throw error;
    }
};

/**
 * Get analytics for a project
 */
export const getProjectAnalytics = async (projectId: number) => {
    try {
        const logs = await db
            .select()
            .from(sqlAssistantLogs)
            .where(eq(sqlAssistantLogs.projectId, projectId));

        const totalQueries = logs.length;
        const successfulQueries = logs.filter(l => l.status === 'success').length;
        const errorQueries = logs.filter(l => l.status === 'error').length;
        const noDataQueries = logs.filter(l => l.status === 'no_data').length;

        const avgExecutionTime = logs.reduce((sum, l) => sum + (l.executionTimeMs || 0), 0) / totalQueries;
        const avgTokens = logs.reduce((sum, l) => {
            const tokens = l.tokenUsage as any;
            return sum + (tokens?.totalTokens || 0);
        }, 0) / totalQueries;

        return {
            totalQueries,
            successfulQueries,
            errorQueries,
            noDataQueries,
            avgExecutionTime: Math.round(avgExecutionTime),
            avgTokens: Math.round(avgTokens),
        };
    } catch (error) {
        console.error('Error fetching analytics:', error);
        throw error;
    }
};

import { eq, desc } from 'drizzle-orm';
