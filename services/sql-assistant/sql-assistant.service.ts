import { DatabaseService } from './database.service';
import { SchemaService } from './schema.service';
import { AIService } from './ai.service';
import { QueryService } from './query.service';
import { ResponseService } from './response.service';
import { BusinessRuleService } from './business-rule.service';
import {
    DatabaseConfig,
    AIProvider,
    StreamEventType,
    StreamEvent,
    ProjectConfig,
} from '../../types/sql-assistant.types';
import {
    DatabaseConnectionError,
    SchemaRetrievalError,
    QueryExecutionError,
} from '../../types/errors';
import logger from '../../utils/logger';

/**
 * Main SQL Assistant service that orchestrates all sub-services
 */
export class SQLAssistantService {
    private databaseService: DatabaseService;
    private schemaService: SchemaService;
    private aiService: AIService;
    private queryService: QueryService;
    private responseService: ResponseService;
    private businessRuleService: BusinessRuleService;
    private tableNames: string[];

    constructor(projectConfig: ProjectConfig, dbConfig: DatabaseConfig) {
        // Initialize services
        this.databaseService = new DatabaseService(dbConfig);
        this.schemaService = new SchemaService(this.databaseService, projectConfig.id);

        this.aiService = new AIService({
            provider: AIProvider.GEMINI,
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            temperature: 0.0,
        });

        this.businessRuleService = new BusinessRuleService(
            projectConfig.id,
            projectConfig.businessRule
        );

        this.queryService = new QueryService(
            this.databaseService,
            this.aiService,
            this.businessRuleService
        );

        this.responseService = new ResponseService(this.aiService);

        this.tableNames = projectConfig.tables || [];
    }

    /**
     * Connect to the database
     */
    async connect(): Promise<void> {
        await this.databaseService.connect();
    }

    /**
     * Disconnect from the database
     */
    async disconnect(): Promise<void> {
        await this.databaseService.disconnect();
    }

    /**
     * Get available tables
     */
    async getAvailableTables(): Promise<string[]> {
        return await this.schemaService.getAvailableTables();
    }

    /**
     * Get table schema
     */
    async getTableSchema(tableNames?: string[]): Promise<string> {
        const tables = tableNames || this.tableNames;
        return await this.schemaService.getTableSchemaAsCSV(tables);
    }

    /**
     * Ask a question and get a response (non-streaming)
     */
    async ask(query: string, chatHistory: string = ''): Promise<string> {
        try {
            // Step 1: Get schema
            const schema = await this.schemaService.getTableSchemaAsCSV(this.tableNames);

            // Step 2: Generate and execute SQL
            const { sql, rows } = await this.queryService.generateAndExecute(
                this.tableNames,
                schema,
                query,
                chatHistory
            );

            // Check for no relevant data
            if (sql === 'NO_RELEVANT_DATA') {
                return "I couldn't find relevant data in the table for your query.";
            }

            // Check for no results
            if (rows.length === 0) {
                return 'Your query executed successfully, but no results were found.';
            }

            // Step 3: Generate response
            const response = await this.responseService.generateResponse(
                rows,
                query,
                chatHistory
            );

            return response;
        } catch (error) {
            if (
                error instanceof DatabaseConnectionError ||
                error instanceof SchemaRetrievalError ||
                error instanceof QueryExecutionError
            ) {
                return `Error: ${error.message}`;
            }

            logger.error('Unexpected error in ask():', error);
            return `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    /**
     * Ask a question and get a streaming response
     */
    async *askStream(
        query: string,
        chatHistory: string = ''
    ): AsyncGenerator<StreamEvent> {
        try {
            // Step 1: Get schema
            yield {
                type: StreamEventType.STATUS,
                content: 'Analyzing database schema...',
            };
            console.time('getTableSchema')
            const schema = await this.schemaService.getTableSchemaAsCSV(this.tableNames);
            console.timeEnd('getTableSchema')

            // Step 2: Generate SQL
            yield {
                type: StreamEventType.STATUS,
                content: 'Generating SQL query...',
            };
            console.time('generateAndExecute')
            const { sql, rows } = await this.queryService.generateAndExecute(
                this.tableNames,
                schema,
                query,
                chatHistory
            );
            console.timeEnd('generateAndExecute')

            // Check for no relevant data
            if (sql === 'NO_RELEVANT_DATA') {
                yield {
                    type: StreamEventType.CONTENT,
                    content: "I couldn't find relevant data in the table for your query.",
                };
                yield {
                    type: StreamEventType.DONE,
                    content: 'Done'
                }   
                return;
            }

            logger.info(`Generated SQL: ${sql}`);
            yield {
                type: StreamEventType.STATUS,
                content: 'Executing SQL query...',
            };
           
            // Check for no results
            if (rows.length === 0) {
                yield {
                    type: StreamEventType.CONTENT,
                    content: 'Your query executed successfully, but no results were found.',
                };
                return;
            }
          
            // Step 3: Generate response
            yield {
                type: StreamEventType.STATUS,
                content: 'Formulating response...',
            };
            console.time('generateResponseStream')
            for await (const chunk of this.responseService.generateResponseStream(
                rows,
                query,
                chatHistory
            )) {
                yield {
                    type: StreamEventType.CONTENT,
                    content: chunk,
                };
            }
            console.timeEnd('generateResponseStream')
            // Send metadata
            yield {
                type: StreamEventType.METADATA,
                sql,
                rowCount: rows.length,
            };

            yield {
                type:StreamEventType.DONE,
                content: 'Done'
            }
        } catch (error) {
            if (
                error instanceof DatabaseConnectionError ||
                error instanceof SchemaRetrievalError ||
                error instanceof QueryExecutionError
            ) {
                yield {
                    type: StreamEventType.ERROR,
                    content: `Error: ${error.message}`,
                };
            } else {
                logger.error('Unexpected error in askStream():', error);
                yield {
                    type: StreamEventType.ERROR,
                    content: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        }
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        return await this.databaseService.testConnection();
    }
}
