import { Request, Response } from 'express';
import { getProjectById, getProjectBySlug } from '../services/project.service';
import { getMessages, sendMessage } from '../services/chat.service';
import { SQLAssistantService } from '../services/sql-assistant';
import { DatabaseConfig, StreamEventType } from '../types/sql-assistant.types';
import logger from '../utils/logger';

/**
 * SQL Assistant Controller
 */

// Store active SQL assistant instances per project and model
const assistantInstances = new Map<string, SQLAssistantService>();

/**
 * Get or create SQL assistant instance for a project
 */
const getAssistantInstance = async (projectId: number, model?: string): Promise<SQLAssistantService> => {
    // Create a unique key for the instance based on projectId and model
    const instanceKey = model ? `${projectId}_${model}` : `${projectId}`;

    // Check if instance exists
    if (assistantInstances.has(instanceKey)) {
        return assistantInstances.get(instanceKey)!;
    }

    // Get project details
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    // Validate project has required configuration
    if (!project.dbConfig) {
        throw new Error('Project database configuration not found');
    }

    if (!project.tables || project.tables.length === 0) {
        throw new Error('Project tables not configured');
    }

    // Create new instance
    const assistant = new SQLAssistantService(
        {
            id: project.id,
            name: project.name,
            slug: project.slug,
            tables: project.tables as string[],
            businessRule: project.businessRule || undefined,
            dbConfig: project.dbConfig as DatabaseConfig,
        },
        project.dbConfig as DatabaseConfig,
        model
    );

    // Connect to database
    await assistant.connect();

    // Store instance
    assistantInstances.set(instanceKey, assistant);

    return assistant;
};

/**
 * Format chat messages into chat history string
 */
const formatChatHistory = (messages: Array<{ role: string; content: string }>): string => {
    return messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
};

/**
 * Execute SQL query (non-streaming)
 */
export const executeQuery = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;
        const { query, chatId } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Get project
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get chat history if chatId provided
        let chatHistory = '';
        if (chatId) {
            const messages = await getMessages(chatId);
            // Exclude the last message (current query) from history
            const historyMessages = messages.slice(0, -1);
            chatHistory = formatChatHistory(historyMessages);
        }

        // Get assistant instance
        const assistant = await getAssistantInstance(project.id);

        // Execute query
        const response = await assistant.ask(query, chatHistory);

        // Save assistant response if chatId provided
        if (chatId) {
            await sendMessage(chatId, response, 'assistant');
        }

        res.json({ response });
    } catch (error) {
        logger.error('Error executing query:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};

/**
 * Execute SQL query with streaming
 */
export const executeQueryStream = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;
        const { query, chatId, model } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Validate model if provided
        const validModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview'];
        if (model && !validModels.includes(model)) {
            return res.status(400).json({
                error: 'Invalid model specified. Supported models: gemini-2.5-pro, gemini-2.5-flash, gemini-3-pro-preview'
            });
        }

        // Get project
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        await sendMessage(chatId, query, 'user');
        // Get chat history if chatId provided
        let chatHistory = '';
        if (chatId) {
            const messages = await getMessages(chatId);
            // Exclude the last message (current query) from history
            const historyMessages = messages.slice(0, -1);
            chatHistory = formatChatHistory(historyMessages);
        }

        // Get assistant instance with specified model
        const assistant = await getAssistantInstance(project.id, model);

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Stream response and collect full response
        let fullResponse = '';
        for await (const event of assistant.askStream(query, chatHistory, chatId)) {
            // Collect content chunks
            if (event.type === StreamEventType.CONTENT && event.content) {
                fullResponse += event.content;
            }

            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Save assistant response if chatId provided
        if (chatId && fullResponse) {
            await sendMessage(chatId, fullResponse, 'assistant');
        }

        res.end();
    } catch (error) {
        logger.error('Error executing query stream:', error);

        // Send error event
        const errorEvent = {
            type: StreamEventType.ERROR,
            content: error instanceof Error ? error.message : 'Internal server error',
        };

        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        res.end();
    }
};

/**
 * Get available tables
 */
export const getAvailableTables = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;

        // Get project
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get assistant instance
        const assistant = await getAssistantInstance(project.id);

        // Get tables
        const tables = await assistant.getAvailableTables();

        res.json({ tables });
    } catch (error) {
        logger.error('Error getting tables:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};

/**
 * Get table schema
 */
export const getTableSchema = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;
        const { tables } = req.query;

        // Get project
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get assistant instance
        const assistant = await getAssistantInstance(project.id);

        // Parse tables
        const tableNames = tables ? (tables as string).split(',') : undefined;

        // Get schema
        const schema = await assistant.getTableSchema(tableNames);

        res.json({ schema });
    } catch (error) {
        logger.error('Error getting schema:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};

/**
 * Test database connection
 */
export const testConnection = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;
        console.log(projectSlug);
        // Get project
        const projectData = await getProjectBySlug(projectSlug);
        console.log(projectData);
        if (!projectData) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get assistant instance
        const assistant = await getAssistantInstance(projectData.id);

        // Test connection
        const isConnected = await assistant.testConnection();

        res.json({ connected: isConnected });
    } catch (error) {
        logger.error('Error testing connection:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
            connected: false,
        });
    }
};

/**
 * Disconnect from database (cleanup)
 */
export const disconnectProject = async (req: Request, res: Response) => {
    try {
        const { projectSlug } = req.params;

        // Get project
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get and remove all instances for this project (across all models)
        const keysToDelete: string[] = [];
        for (const [key, assistant] of assistantInstances.entries()) {
            // Check if the key starts with the project ID
            if (key.startsWith(`${project.id}_`) || key === `${project.id}`) {
                await assistant.disconnect();
                keysToDelete.push(key);
            }
        }

        // Delete all instances
        keysToDelete.forEach(key => assistantInstances.delete(key));

        res.json({ message: 'Disconnected successfully' });
    } catch (error) {
        logger.error('Error disconnecting:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};
