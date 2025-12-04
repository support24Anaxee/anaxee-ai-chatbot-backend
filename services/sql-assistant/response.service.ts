import { RowDataPacket } from 'mysql2/promise';
import { AIService } from './ai.service';
import logger from '../../utils/logger';

/**
 * Response service for generating natural language responses from query results
 */
export class ResponseService {
    constructor(private aiService: AIService) { }

    /**
     * Generate natural language response from query results
     */
    async generateResponse(
        rows: RowDataPacket[],
        userQuery: string,
        chatHistory: string = ''
    ): Promise<string> {
        try {
            const context = JSON.stringify(rows, null, 2);

            const prompt = `Context (Query Results):
${context}

Chat History:
${chatHistory}

User Query: ${userQuery}`;

            const systemInstruction = `You are a helpful SQL assistant. Using the provided query results:
1. Answer the user's question accurately and concisely
2. Present data in a clear, readable format
3. Use tables or lists when appropriate for multiple records
4. Highlight key insights or patterns
5. If no results were found, explain that clearly
6. Maintain a natural, conversational tone
7. Reference specific numbers and facts from the results`;

            const response = await this.aiService.generateContent(
                systemInstruction,
                prompt,
                0.3
            );

            return response;
        } catch (error) {
            logger.error('Error generating response:', error);
            throw error;
        }
    }

    /**
     * Generate natural language response with streaming
     */
    /**
     * Generate natural language response with streaming
     */
    async *generateResponseStream(
        rows: RowDataPacket[],
        userQuery: string,
        chatHistory: string = ''
    ): AsyncGenerator<{ type: 'text' | 'chart', content?: string, spec?: any }> {
        try {
            const context = JSON.stringify(rows, null, 2);

            const prompt = `Context (Query Results):
${context}

Chat History:
${chatHistory}

User Query: ${userQuery}`;

            const systemInstruction = `You are a helpful SQL assistant. Using the provided query results:
1. Answer the user's question accurately and concisely
2. Present data in a clear, readable format
3. Use tables or lists when appropriate for multiple records
4. Highlight key insights or patterns
5. If no results were found, explain that clearly
6. Maintain a natural, conversational tone
7. Reference specific numbers and facts from the results
8. If the user explicitly asks for a chart or graph AND the data is suitable (numerical data with categories or time series), use the generate_chart tool.
9. Do NOT generate a chart unless explicitly asked.`;

            const tools = [{
                functionDeclarations: [{
                    name: 'generate_chart',
                    description: 'Generate a chart/graph visualization for the data. Use this ONLY when the user explicitly asks for a chart and the data is suitable.',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            type: {
                                type: 'STRING',
                                enum: ['bar', 'line', 'pie', 'area', 'scatter'],
                                description: 'The type of chart to generate'
                            },
                            title: {
                                type: 'STRING',
                                description: 'The title of the chart'
                            },
                            description: {
                                type: 'STRING',
                                description: 'A brief description of what the chart shows'
                            },
                            data: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    description: 'Data point with key-value pairs'
                                },
                                description: 'The data to visualize. Must be an array of objects.'
                            },
                            xKey: {
                                type: 'STRING',
                                description: 'The key in the data objects to use for the X-axis (categories/time)'
                            },
                            yKeys: {
                                type: 'ARRAY',
                                items: { type: 'STRING' },
                                description: 'The keys in the data objects to use for the Y-axis (values)'
                            },
                            colors: {
                                type: 'ARRAY',
                                items: { type: 'STRING' },
                                description: 'Optional hex color codes for the chart'
                            }
                        },
                        required: ['type', 'title', 'data', 'xKey', 'yKeys']
                    }
                }]
            }];

            for await (const chunk of this.aiService.generateContentStream(
                systemInstruction,
                prompt,
                0.3,
                tools
            )) {
                if (chunk.type === 'text') {
                    yield { type: 'text', content: chunk.content };
                } else if (chunk.type === 'function_call' && chunk.name === 'generate_chart') {
                    yield { type: 'chart', spec: chunk.args };
                }
            }
        } catch (error) {
            logger.error('Error generating response stream:', error);
            yield { type: 'text', content: `Error generating response: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    /**
     * Generate response from chat history only (without new query results)
     */
    async generateResponseFromHistory(
        userQuery: string,
        chatHistory: string
    ): Promise<string> {
        try {
            const prompt = `Chat History:
${chatHistory}

User Query: ${userQuery}`;

            const systemInstruction = `You are a helpful SQL assistant. Using ONLY the information from the chat history:
1. Answer the user's question accurately and concisely
2. Reference specific data points from the previous conversation
3. Present information in a clear, readable format
4. Use tables or lists when appropriate
5. Maintain a natural, conversational tone
6. If the user asks for clarification or details about previous results, provide them
7. Do NOT make up or infer data that wasn't in the chat history`;

            const response = await this.aiService.generateContent(
                systemInstruction,
                prompt,
                0.3
            );

            return response;
        } catch (error) {
            logger.error('Error generating response from history:', error);
            throw error;
        }
    }

    /**
     * Generate response from chat history only with streaming
     */
    async *generateResponseFromHistoryStream(
        userQuery: string,
        chatHistory: string
    ): AsyncGenerator<{ type: 'text' | 'chart', content?: string, spec?: any }> {
        try {
            const prompt = `Chat History:
${chatHistory}

User Query: ${userQuery}`;

            const systemInstruction = `You are a helpful SQL assistant. Using ONLY the information from the chat history:
1. Answer the user's question accurately and concisely
2. Reference specific data points from the previous conversation
3. Present information in a clear, readable format
4. Use tables or lists when appropriate
5. Maintain a natural, conversational tone
6. If the user asks for clarification or details about previous results, provide them
7. Do NOT make up or infer data that wasn't in the chat history
8. If the user explicitly asks for a chart or graph AND the data is suitable (numerical data with categories or time series), use the generate_chart tool.
9. Do NOT generate a chart unless explicitly asked.`;

            const tools = [{
                functionDeclarations: [{
                    name: 'generate_chart',
                    description: 'Generate a chart/graph visualization for the data. Use this ONLY when the user explicitly asks for a chart and the data is suitable.',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            type: {
                                type: 'STRING',
                                enum: ['bar', 'line', 'pie', 'area', 'scatter'],
                                description: 'The type of chart to generate'
                            },
                            title: {
                                type: 'STRING',
                                description: 'The title of the chart'
                            },
                            description: {
                                type: 'STRING',
                                description: 'A brief description of what the chart shows'
                            },
                            data: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    description: 'Data point with key-value pairs'
                                },
                                description: 'The data to visualize. Must be an array of objects.'
                            },
                            xKey: {
                                type: 'STRING',
                                description: 'The key in the data objects to use for the X-axis (categories/time)'
                            },
                            yKeys: {
                                type: 'ARRAY',
                                items: { type: 'STRING' },
                                description: 'The keys in the data objects to use for the Y-axis (values)'
                            },
                            colors: {
                                type: 'ARRAY',
                                items: { type: 'STRING' },
                                description: 'Optional hex color codes for the chart'
                            }
                        },
                        required: ['type', 'title', 'data', 'xKey', 'yKeys']
                    }
                }]
            }];

            for await (const chunk of this.aiService.generateContentStream(
                systemInstruction,
                prompt,
                0.3,
                tools
            )) {
                if (chunk.type === 'text') {
                    yield { type: 'text', content: chunk.content };
                } else if (chunk.type === 'function_call' && chunk.name === 'generate_chart') {
                    yield { type: 'chart', spec: chunk.args };
                }
            }
        } catch (error) {
            logger.error('Error generating response from history stream:', error);
            yield { type: 'text', content: `Error generating response: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
}
