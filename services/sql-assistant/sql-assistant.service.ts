import { DatabaseService } from './database.service';
import { SchemaService } from './schema.service';
import { AIService } from './ai.service';
import { QueryService } from './query.service';
import { ResponseService } from './response.service';
import { BusinessRuleService } from './business-rule.service';
import { ContextEvaluationService } from './context-evaluation.service';
import { createLog } from '../sql-assistant-logging.service';
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
    private contextEvaluationService: ContextEvaluationService;
    private tableNames: string[];
    private projectConfig: ProjectConfig;

    constructor(projectConfig: ProjectConfig, dbConfig: DatabaseConfig, model?: string) {
        this.projectConfig = projectConfig;
        // Initialize services
        this.databaseService = new DatabaseService(dbConfig);
        this.schemaService = new SchemaService(this.databaseService, projectConfig.id);

        // Use provided model or fallback to environment variable or default
        const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

        this.aiService = new AIService({
            provider: AIProvider.GEMINI,
            model: selectedModel,
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

        this.contextEvaluationService = new ContextEvaluationService();

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
        chatHistory: string = '',
        chatId?: number
    ): AsyncGenerator<StreamEvent> {
        const startTime = Date.now();
        let contextEvaluationTime = 0;
        let schemaFetchTime = 0;
        let sqlGenerationTime = 0;
        let queryExecutionTime = 0;
        let responseGenerationTime = 0;
        let generatedSql = '';
        let rowCount = 0;
        let tokenUsage: any = null;
        let status: 'success' | 'error' | 'no_data' = 'success';
        let errorMessage: string | undefined;
        let ragSkipped = false;
        let contextDecision = '';

        try {
            // Step 0: Evaluate if chat history has sufficient context
            if (chatHistory && chatHistory.trim().length > 0) {
                yield {
                    type: StreamEventType.STATUS,
                    content: 'Evaluating context...',
                };

                const contextEvalStart = Date.now();
                const evaluation = await this.contextEvaluationService.evaluateContext(
                    query,
                    chatHistory
                );
                contextEvaluationTime = Date.now() - contextEvalStart;
                contextDecision = evaluation.decision;

                logger.info(`Context evaluation: ${evaluation.decision} - ${evaluation.reasoning}`);

                // If context is sufficient, skip RAG and generate response from history
                if (evaluation.decision === 'SUFFICIENT') {
                    ragSkipped = true;

                    yield {
                        type: StreamEventType.STATUS,
                        content: 'Generating response from context...',
                    };

                    const responseStart = Date.now();
                    for await (const chunk of this.responseService.generateResponseFromHistoryStream(
                        query,
                        chatHistory
                    )) {
                        yield {
                            type: StreamEventType.CONTENT,
                            content: chunk,
                        };
                    }
                    responseGenerationTime = Date.now() - responseStart;

                    // Get token usage
                    tokenUsage = this.aiService.getLastTokenUsage();

                    // Send metadata indicating RAG was skipped
                    yield {
                        type: StreamEventType.METADATA,
                        ragSkipped: true,
                    };

                    yield {
                        type: StreamEventType.DONE,
                        content: 'Done'
                    };

                    // Log successful execution with RAG skipped
                    await createLog({
                        chatId,
                        projectId: this.projectConfig.id,
                        userMessage: query,
                        generatedSql: 'SKIPPED - Context sufficient',
                        executionTimeMs: Date.now() - startTime,
                        contextEvaluationTimeMs: contextEvaluationTime,
                        responseGenerationTimeMs: responseGenerationTime,
                        tokenUsage,
                        status: 'success',
                        ragSkipped,
                        contextDecision,
                    });

                    return;
                }
            }

            // Continue with normal RAG flow if context is not sufficient
            // Step 1: Get schema
            yield {
                type: StreamEventType.STATUS,
                content: 'Analyzing database schema...',
            };
            const schemaStart = Date.now();
            const schema = await this.schemaService.getTableSchemaAsCSV(this.tableNames);
            schemaFetchTime = Date.now() - schemaStart;

            // Step 2: Generate SQL
            yield {
                type: StreamEventType.STATUS,
                content: 'Generating SQL query...',
            };

            const sqlStart = Date.now();
            const { sql, rows, executionTime } = await this.queryService.generateAndExecute(
                this.tableNames,
                schema,
                query,
                chatHistory
            );
            console.log(executionTime)
            queryExecutionTime = executionTime;
            const sqlEnd = Date.now();
            sqlGenerationTime = sqlEnd - sqlStart;
            generatedSql = sql;
            rowCount = rows.length;

            // Check for no relevant data
            if (sql === 'NO_RELEVANT_DATA') {
                status = 'no_data';
                yield {
                    type: StreamEventType.CONTENT,
                    content: "I couldn't find relevant data in the table for your query.",
                };
                yield {
                    type: StreamEventType.DONE,
                    content: 'Done'
                };

                // Log before return
                await createLog({
                    chatId,
                    projectId: this.projectConfig.id,
                    userMessage: query,
                    generatedSql: sql,
                    executionTimeMs: Date.now() - startTime,
                    contextEvaluationTimeMs: contextEvaluationTime,
                    schemaFetchTimeMs: schemaFetchTime,
                    sqlGenerationTimeMs: sqlGenerationTime,
                    status,
                    ragSkipped,
                    contextDecision,
                });
                return;
            }

            logger.info(`Generated SQL: ${sql}`);
            yield {
                type: StreamEventType.STATUS,
                content: 'Executing SQL query...',
            };

            // Check for no results
            if (rows.length === 0) {
                status = 'no_data';
                yield {
                    type: StreamEventType.CONTENT,
                    content: 'Your query executed successfully, but no results were found.',
                };
                yield {
                    type: StreamEventType.DONE,
                    content: 'Done'
                };

                // Log before return
                await createLog({
                    chatId,
                    projectId: this.projectConfig.id,
                    userMessage: query,
                    generatedSql: sql,
                    executionTimeMs: Date.now() - startTime,
                    queryExecutionTimeMs: queryExecutionTime,
                    contextEvaluationTimeMs: contextEvaluationTime,
                    schemaFetchTimeMs: schemaFetchTime,
                    sqlGenerationTimeMs: sqlGenerationTime,
                    rowCount: 0,
                    status,
                    ragSkipped,
                    contextDecision,
                });
                return;
            }

            // Step 3: Generate response
            yield {
                type: StreamEventType.STATUS,
                content: 'Formulating response...',
            };
            const responseStart = Date.now();
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
            responseGenerationTime = Date.now() - responseStart;

            // Get token usage from AI service
            tokenUsage = this.aiService.getLastTokenUsage();

            // Send metadata
            yield {
                type: StreamEventType.METADATA,
                sql,
                rowCount: rows.length,
                ragSkipped: false,
            };

            yield {
                type: StreamEventType.DONE,
                content: 'Done'
            };

            // Log successful execution
            await createLog({
                chatId,
                projectId: this.projectConfig.id,
                userMessage: query,
                generatedSql: sql,
                executionTimeMs: Date.now() - startTime,
                contextEvaluationTimeMs: contextEvaluationTime,
                schemaFetchTimeMs: schemaFetchTime,
                queryExecutionTimeMs: queryExecutionTime,
                sqlGenerationTimeMs: sqlGenerationTime,
                responseGenerationTimeMs: responseGenerationTime,
                rowCount: rows.length,
                tokenUsage,
                status: 'success',
                ragSkipped,
                contextDecision,
            });
        } catch (error) {
            status = 'error';
            errorMessage = error instanceof Error ? error.message : String(error);

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

            // Log error
            await createLog({
                chatId,
                projectId: this.projectConfig.id,
                userMessage: query,
                generatedSql,
                executionTimeMs: Date.now() - startTime,
                schemaFetchTimeMs: schemaFetchTime,
                sqlGenerationTimeMs: sqlGenerationTime,
                rowCount,
                status,
                errorMessage,
            });
        }
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<boolean> {
        return await this.databaseService.testConnection();
    }
}
