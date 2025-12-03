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
    async *generateResponseStream(
        rows: RowDataPacket[],
        userQuery: string,
        chatHistory: string = ''
    ): AsyncGenerator<string> {
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

            for await (const chunk of this.aiService.generateContentStream(
                systemInstruction,
                prompt,
                0.3
            )) {
                yield chunk;
            }
        } catch (error) {
            logger.error('Error generating response stream:', error);
            yield `Error generating response: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
