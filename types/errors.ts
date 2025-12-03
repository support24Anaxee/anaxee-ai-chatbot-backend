/**
 * Custom error classes for SQL Assistant
 */

export class DatabaseConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseConnectionError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class SchemaRetrievalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SchemaRetrievalError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class QueryExecutionError extends Error {
    public query?: string;

    constructor(message: string, query?: string) {
        super(message);
        this.name = 'QueryExecutionError';
        this.query = query;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class CacheError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CacheError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class AIServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AIServiceError';
        Error.captureStackTrace(this, this.constructor);
    }
}
