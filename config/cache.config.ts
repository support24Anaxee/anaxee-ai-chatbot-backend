import { CacheConfig } from '../types/sql-assistant.types';

/**
 * Cache configuration constants
 */
export const cacheConfig: CacheConfig = {
    schemaTTL: 3600, // 1 hour in seconds
    businessRuleTTL: 86400, // 24 hours in seconds
    tablesTTL: 3600, // 1 hour in seconds
};

/**
 * Cache key prefixes
 */
export const CacheKeys = {
    SCHEMA: 'schema',
    BUSINESS_RULE: 'business-rule',
    TABLES: 'tables',
} as const;

/**
 * Generate cache key for schema
 */
export const generateSchemaKey = (projectId: number, tableNames: string[]): string => {
    const sortedTables = [...tableNames].sort().join(',');
    return `${CacheKeys.SCHEMA}:${projectId}:${sortedTables}`;
};

/**
 * Generate cache key for business rule
 */
export const generateBusinessRuleKey = (projectId: number): string => {
    return `${CacheKeys.BUSINESS_RULE}:${projectId}`;
};

/**
 * Generate cache key for tables
 */
export const generateTablesKey = (projectId: number): string => {
    return `${CacheKeys.TABLES}:${projectId}`;
};
