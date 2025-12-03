import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DatabaseConfig } from '../../types/sql-assistant.types';
import { DatabaseConnectionError } from '../../types/errors';
import logger from '../../utils/logger';

/**
 * Database service for managing SQL Assistant database connections
 * Separate from the main app database connection
 */
export class DatabaseService {
    private pool: Pool | null = null;
    private config: DatabaseConfig;

    constructor(config: DatabaseConfig) {
        this.config = config;
    }

    /**
     * Connect to the database
     */
    async connect(): Promise<void> {
        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                port: this.config.port || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
            
            });

            // Test connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            logger.info(`Connected to database: ${this.config.database}`);
        } catch (error) {
            logger.error('Database connection failed:', error);
            throw new DatabaseConnectionError(
                `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get a connection from the pool
     */
    async getConnection(): Promise<PoolConnection> {
        if (!this.pool) {
            throw new DatabaseConnectionError('Database not connected. Call connect() first.');
        }

        try {
            return await this.pool.getConnection();
        } catch (error) {
            throw new DatabaseConnectionError(
                `Failed to get connection: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Execute a query
     */
    async query<T extends RowDataPacket[]>(
        sql: string,
        values?: any[]
    ): Promise<T> {
        const connection = await this.getConnection();
        try {
            const [rows] = await connection.query<T>(sql, values);
            return rows;
        } finally {
            connection.release();
        }
    }

    /**
     * Get list of tables in the database
     */
    async getTables(): Promise<string[]> {
        try {
            const rows = await this.query<RowDataPacket[]>('SHOW TABLES');
            const dbName = this.config.database;
            const key = `Tables_in_${dbName}`;
            return rows.map((row) => row[key] as string);
        } catch (error) {
            logger.error('Error getting tables:', error);
            throw new DatabaseConnectionError(
                `Failed to get tables: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const connection = await this.getConnection();
            await connection.ping();
            connection.release();
            return true;
        } catch (error) {
            logger.error('Connection test failed:', error);
            return false;
        }
    }

    /**
     * Disconnect from the database
     */
    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info('Database connection closed');
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.pool !== null;
    }
}
