import { RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from './database.service';
import { ColumnInfo } from '../../types/sql-assistant.types';
import { SchemaRetrievalError } from '../../types/errors';
import { getOrSetCached } from '../../utils/cache-utils';
import { generateSchemaKey, generateTablesKey } from '../../config/cache.config';
import { cacheConfig } from '../../config/cache.config';
import logger from '../../utils/logger';

/**
 * Schema service for retrieving and caching database schema information
 */
export class SchemaService {
    constructor(
        private databaseService: DatabaseService,
        private projectId: number
    ) { }

    /**
     * Get table schema as CSV formatted string with caching
     */
    async getTableSchemaAsCSV(tableNames: string[]): Promise<string> {
        const cacheKey = generateSchemaKey(this.projectId, tableNames);

        try {
            return await getOrSetCached(
                cacheKey,
                cacheConfig.schemaTTL,
                async () => await this.fetchTableSchema(tableNames)
            );
        } catch (error) {
            logger.error('Error getting table schema:', error);
            throw new SchemaRetrievalError(
                `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Fetch table schema from database (no cache)
     */
    private async fetchTableSchema(tableNames: string[]): Promise<string> {
        try {
            // Get available tables
            const availableTables = await this.databaseService.getTables();

            const csvLines: string[] = [
                'Table_Name,Column_Name,Type,Nullable,Sample_Content'
            ];

            for (const tableName of tableNames) {
                if (!availableTables.includes(tableName)) {
                    logger.warn(`Table '${tableName}' not found. Skipping.`);
                    continue;
                }

                // Get column information
                const columns = await this.getTableColumns(tableName);

                // Get sample row
                const sampleRow = await this.getSampleRow(tableName);

                // Build CSV rows
                for (const col of columns) {
                    const sampleValue = sampleRow ? sampleRow[col.columnName] : null;
                    const sampleStr = sampleValue !== null && sampleValue !== undefined
                        ? String(sampleValue).replace(/,/g, ';') // Escape commas
                        : '';

                    csvLines.push(
                        `${tableName},${col.columnName},${col.type},${col.nullable},${sampleStr}`
                    );
                }
            }

            logger.info(`Retrieved schema for tables: ${tableNames.join(', ')}`);
            return csvLines.join('\n');
        } catch (error) {
            logger.error('Error fetching table schema:', error);
            throw new SchemaRetrievalError(
                `Failed to fetch schema: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get column information for a table
     */
    private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
        const query = `
      SELECT 
        COLUMN_NAME as columnName,
        COLUMN_TYPE as type,
        IS_NULLABLE as nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

        const rows = await this.databaseService.query<RowDataPacket[]>(query, [tableName]);

        return rows.map((row) => ({
            tableName,
            columnName: row.columnName as string,
            type: row.type as string,
            nullable: row.nullable as string,
            sampleContent: null,
        }));
    }

    /**
     * Get a sample row from a table
     */
    private async getSampleRow(tableName: string): Promise<RowDataPacket | null> {
        try {
            const query = `SELECT * FROM \`${tableName}\` LIMIT 1`;
            const rows = await this.databaseService.query<RowDataPacket[]>(query);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            logger.warn(`Error getting sample row for ${tableName}:`, error);
            return null;
        }
    }

    /**
     * Get available tables with caching
     */
    async getAvailableTables(): Promise<string[]> {
        const cacheKey = generateTablesKey(this.projectId);

        try {
            return await getOrSetCached(
                cacheKey,
                cacheConfig.tablesTTL,
                async () => await this.databaseService.getTables()
            );
        } catch (error) {
            logger.error('Error getting available tables:', error);
            throw new SchemaRetrievalError(
                `Failed to get tables: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
