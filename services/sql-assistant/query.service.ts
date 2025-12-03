import { RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from './database.service';
import { AIService } from './ai.service';
import { BusinessRuleService } from './business-rule.service';
import { QueryExecutionError } from '../../types/errors';
import { extractSQLQuery, isValidSQL, isNoRelevantData } from '../../utils/sql-utils';
import logger from '../../utils/logger';

/**
 * Query service for generating and executing SQL queries
 */
export class QueryService {
    constructor(
        private databaseService: DatabaseService,
        private aiService: AIService,
        private businessRuleService: BusinessRuleService
    ) { }

    /**
     * Generate SQL query from natural language
     */
    async generateSQLQuery(
        tableNames: string[],
        schema: string,
        userQuery: string,
        chatHistory: string = '',
        lastGeneratedQuery?:string,
        lastError?:string

    ): Promise<string> {
        try {
            // Get business rules
            const businessRules = await this.businessRuleService.formatForPrompt();

            const prompt = `Table Names: ${tableNames.join(', ')}

Schema:
${schema}

Chat History:
${chatHistory}

Question: ${userQuery}

${(lastGeneratedQuery && lastError) ? `Last Generated Query : ${lastGeneratedQuery} \n Last Error : ${lastError}` : ''}
`


;

            const systemInstruction = `Required Output: SQL Query String

Instructions:
1. Generate a MySQL query that answers the user's question based on the provided schema
2. Retrieve all relevant information to provide complete context
3. Return ONLY the SQL query with no titles, explanations, or markdown
4. For text field comparisons, use LOWER() function and wildcards: LOWER(field) LIKE '%value%'
5. Use backticks for table and column names to handle reserved words
6. If the question is unrelated to the schema, respond with: "NO_RELEVANT_DATA"
7. Optimize for readability with proper formatting
8. Use JOINs where appropriate if relationships are evident
${businessRules}`;

            const response = await this.aiService.generateContent(
                systemInstruction,
                prompt,
                0.0
            );

            const sqlQuery = extractSQLQuery(response);

            // Validate
            if (isNoRelevantData(sqlQuery)) {
                return 'NO_RELEVANT_DATA';
            }

            if (!isValidSQL(sqlQuery)) {
                throw new QueryExecutionError('Generated query is not valid SQL', sqlQuery);
            }

            logger.info(`Generated SQL: ${sqlQuery}`);
            return sqlQuery;
        } catch (error) {
            logger.error('Error generating SQL query:', error);
            throw error;
        }
    }

    /**
     * Execute SQL query
     */
    async executeQuery(sqlQuery: string): Promise<RowDataPacket[]> {
        try {
            const rows = await this.databaseService.query<RowDataPacket[]>(sqlQuery);
            logger.info(`Query executed successfully. Rows returned: ${rows.length}`);
            return rows;
        } catch (error) {
            logger.error('SQL execution error:', error);
            throw new QueryExecutionError(
                `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
                sqlQuery
            );
        }
    }

    /**
     * Generate and execute SQL query
     */
    async generateAndExecute(
        tableNames: string[],
        schema: string,
        userQuery: string,
        chatHistory: string = ''
    ): Promise<{ sql: string; rows: RowDataPacket[], executionTime:number }> {
        console.time('generateSQLQuery')
        const sql = await this.generateSQLQuery(tableNames, schema, userQuery, chatHistory);
        console.timeEnd('generateSQLQuery')
        if (sql === 'NO_RELEVANT_DATA') {
            return { sql, rows: [], executionTime:0 };
        }
        console.time('executionQuery')
        const timeStart = Date.now()
        let rows;
        try {
            
             rows = await this.executeQuery(sql);
        } catch (error) {
            logger.error('SQL execution error retrying: ', error);
            const sqlNew = await this.generateSQLQuery(tableNames, schema, userQuery, chatHistory, sql, error instanceof Error ? error.message : String(error));
            rows = await this.executeQuery(sqlNew);
        }
        const executionTime = Date.now() - timeStart ;
        console.timeEnd('executionQuery')
        return { sql, rows, executionTime };
    }
}
