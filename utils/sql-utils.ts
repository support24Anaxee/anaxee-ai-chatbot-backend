/**
 * SQL utility functions
 */

/**
 * Extracts SQL query from markdown code blocks or raw text
 */
export const extractSQLQuery = (text: string): string => {
    // Try to extract from code blocks
    const pattern = /```(?:sql)?\s*(.*?)\s*```/is;
    const match = text.match(pattern);

    if (match) {
        return match[1].trim();
    }

    // Remove common prefixes if present
    const cleaned = text.replace(/^(?:sql query:?|query:?)\s*/i, '');
    return cleaned.trim();
};

/**
 * Validates if a string contains a SQL query
 */
export const isValidSQL = (query: string): boolean => {
    if (!query || query.trim().length === 0) {
        return false;
    }

    // Check for common SQL keywords
    const sqlKeywords = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|SHOW|DESCRIBE|EXPLAIN)/i;
    return sqlKeywords.test(query);
};

/**
 * Checks if query indicates no relevant data
 */
export const isNoRelevantData = (query: string): boolean => {
    return query.includes('NO_RELEVANT_DATA') ||
        query.toLowerCase().includes('no relevant data');
};

/**
 * Sanitizes table name by wrapping in backticks
 */
export const sanitizeTableName = (tableName: string): string => {
    return `\`${tableName.replace(/`/g, '')}\``;
};

/**
 * Sanitizes column name by wrapping in backticks
 */
export const sanitizeColumnName = (columnName: string): string => {
    return `\`${columnName.replace(/`/g, '')}\``;
};
