/**
 * Example usage of SQL Assistant Service
 * This file demonstrates how to use the SQL Assistant programmatically
 */

import { SQLAssistantService } from './services/sql-assistant';
import { AIProvider, ProjectConfig, DatabaseConfig } from './types/sql-assistant.types';

// Example 1: Basic Usage
async function basicExample() {
    console.log('=== Basic SQL Assistant Example ===\n');

    const projectConfig: ProjectConfig = {
        id: 1,
        name: 'Analytics Project',
        slug: 'analytics',
        tables: ['users', 'orders', 'products'],
        businessRule: `
1. Always filter by active records (status = 'active')
2. Use created_at for date ranges
3. Join tables on their primary keys
4. For revenue calculations, use price * quantity
    `.trim(),
    };

    const dbConfig: DatabaseConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'analytics',
        port: 3306,
    };

    // Create assistant instance
    const assistant = new SQLAssistantService(projectConfig, dbConfig);

    try {
        // Connect to database
        await assistant.connect();
        console.log('✓ Connected to database\n');

        // Test connection
        const isConnected = await assistant.testConnection();
        console.log(`✓ Connection test: ${isConnected ? 'PASSED' : 'FAILED'}\n`);

        // Get available tables
        const tables = await assistant.getAvailableTables();
        console.log('Available tables:', tables, '\n');

        // Execute a query
        const query = 'How many users signed up in the last 30 days?';
        console.log(`Query: ${query}\n`);

        const response = await assistant.ask(query);
        console.log('Response:', response, '\n');

        // Cleanup
        await assistant.disconnect();
        console.log('✓ Disconnected from database');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 2: Streaming Response
async function streamingExample() {
    console.log('\n=== Streaming SQL Assistant Example ===\n');

    const projectConfig: ProjectConfig = {
        id: 1,
        name: 'Analytics Project',
        slug: 'analytics',
        tables: ['users', 'orders', 'products'],
    };

    const dbConfig: DatabaseConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'analytics',
        port: 3306,
    };

    const assistant = new SQLAssistantService(projectConfig, dbConfig);

    try {
        await assistant.connect();

        const query = 'Show me the top 10 products by revenue';
        console.log(`Query: ${query}\n`);
        console.log('Streaming response:\n');

        // Stream the response
        for await (const event of assistant.askStream(query)) {
            switch (event.type) {
                case 'status':
                    console.log(`[STATUS] ${event.content}`);
                    break;
                case 'content':
                    process.stdout.write(event.content);
                    break;
                case 'metadata':
                    console.log(`\n\n[METADATA] SQL: ${event.sql}`);
                    console.log(`[METADATA] Rows: ${event.rowCount}`);
                    break;
                case 'error':
                    console.error(`[ERROR] ${event.content}`);
                    break;
            }
        }

        await assistant.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 3: With Chat History
async function chatHistoryExample() {
    console.log('\n=== Chat History Example ===\n');

    const projectConfig: ProjectConfig = {
        id: 1,
        name: 'Analytics Project',
        slug: 'analytics',
        tables: ['users', 'orders'],
    };

    const dbConfig: DatabaseConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'analytics',
        port: 3306,
    };

    const assistant = new SQLAssistantService(projectConfig, dbConfig);

    try {
        await assistant.connect();

        // First question
        const query1 = 'How many users do we have?';
        console.log(`Q1: ${query1}`);
        const response1 = await assistant.ask(query1);
        console.log(`A1: ${response1}\n`);

        // Follow-up question with context
        const chatHistory = `user: ${query1}\nassistant: ${response1}\n`;
        const query2 = 'How many of them placed an order?';
        console.log(`Q2: ${query2}`);
        const response2 = await assistant.ask(query2, chatHistory);
        console.log(`A2: ${response2}\n`);

        await assistant.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 4: Error Handling
async function errorHandlingExample() {
    console.log('\n=== Error Handling Example ===\n');

    const projectConfig: ProjectConfig = {
        id: 1,
        name: 'Test Project',
        slug: 'test',
        tables: ['nonexistent_table'],
    };

    const dbConfig: DatabaseConfig = {
        host: 'invalid-host',
        user: 'invalid-user',
        password: 'invalid-password',
        database: 'invalid-database',
        port: 3306,
    };

    const assistant = new SQLAssistantService(projectConfig, dbConfig);

    try {
        await assistant.connect();
    } catch (error) {
        console.log('✓ Caught connection error:', error instanceof Error ? error.message : error);
    }
}

// Run examples
async function main() {
    // Uncomment the examples you want to run

    // await basicExample();
    // await streamingExample();
    // await chatHistoryExample();
    // await errorHandlingExample();

    console.log('\n✓ All examples completed');
}

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

export {
    basicExample,
    streamingExample,
    chatHistoryExample,
    errorHandlingExample,
};
