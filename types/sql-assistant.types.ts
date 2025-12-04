import { RowDataPacket } from 'mysql2/promise';

/**
 * AI Provider types
 */
export enum AIProvider {
    GEMINI = 'gemini',
    GROQ = 'groq',
}

export interface AIModelConfig {
    provider: AIProvider;
    model: string;
    temperature?: number;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
}

/**
 * Table schema information
 */
export interface ColumnInfo {
    tableName: string;
    columnName: string;
    type: string;
    nullable: string;
    sampleContent: any;
}

export interface TableSchema {
    tableName: string;
    columns: ColumnInfo[];
}

/**
 * Query result types
 */
export interface QueryResult {
    rows: RowDataPacket[];
    rowCount: number;
}

/**
 * Stream event types
 */
export enum StreamEventType {
    STATUS = 'status',
    CONTENT = 'content',
    METADATA = 'metadata',
    CHART = 'chart',
    ERROR = 'error',
    DONE = 'done'
}

/**
 * Chart specification for Recharts
 */
export interface ChartSpec {
    type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
    title: string;
    description?: string;
    data: Array<Record<string, any>>;
    xKey?: string;
    yKeys?: string[];
    nameKey?: string; // For pie charts
    valueKey?: string; // For pie charts
    colors?: string[];
}

export interface StreamEvent {
    type: StreamEventType;
    content?: string;
    sql?: string;
    rowCount?: number;
    ragSkipped?: boolean;
    chartSpec?: ChartSpec;
}

/**
 * Chat history format
 */
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * SQL Assistant request/response types
 */
export interface SQLQueryRequest {
    query: string;
    chatHistory?: string;
    tables?: string[];
}

export interface SQLQueryResponse {
    response: string;
    sql?: string;
    rowCount?: number;
}

/**
 * Business rule configuration
 */
export interface BusinessRule {
    projectId: number;
    rule: string;
    tables: string[];
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    schemaTTL: number;
    businessRuleTTL: number;
    tablesTTL: number;
}

/**
 * Project configuration with SQL assistant settings
 */
export interface ProjectConfig {
    id: number;
    name: string;
    slug: string;
    tables: string[];
    businessRule?: string;
    dbConfig?: DatabaseConfig;
}
