import { AIService } from './ai.service';
import { AIProvider } from '../../types/sql-assistant.types';
import logger from '../../utils/logger';

/**
 * Context evaluation result
 */
export interface ContextEvaluation {
    decision: 'SUFFICIENT' | 'NEED_MORE_DATA';
    reasoning: string;
}

/**
 * Service to evaluate if chat history has sufficient context to answer a query
 * Uses a lighter model for faster and cheaper evaluation
 */
export class ContextEvaluationService {
    private lightAiService: AIService;

    constructor() {
        // Use a lighter, faster model for context evaluation
        this.lightAiService = new AIService({
            provider: AIProvider.GEMINI,
            model: 'gemini-2.0-flash-exp', // Lighter model for faster evaluation
            temperature: 0.0,
        });
    }

    /**
     * Evaluate if chat history contains enough context to answer the query
     */
    async evaluateContext(
        userQuery: string,
        chatHistory: string
    ): Promise<ContextEvaluation> {
        try {
            // If no chat history, we definitely need more data
            if (!chatHistory || chatHistory.trim().length === 0) {
                return {
                    decision: 'NEED_MORE_DATA',
                    reasoning: 'No chat history available',
                };
            }

            const prompt = `Chat History:
${chatHistory}

Current User Query: ${userQuery}`;

            const systemInstruction = `You are a context evaluator for a SQL assistant. Your job is to determine if the chat history contains enough information to answer the user's current query WITHOUT needing to fetch new data from the database.

Analyze the chat history and current query, then respond with ONLY ONE of these two options:

SUFFICIENT - Use this if:
- The chat history contains the specific data needed to answer the query
- The query is asking for clarification, explanation, or reformatting of previous results
- The query is a follow-up question about data already discussed
- The query asks to "show more details", "explain that", "what about X" where X was in previous results

NEED_MORE_DATA - Use this if:
- The query asks for new data not present in chat history
- The query requires filtering, aggregating, or querying data differently
- The query asks about a different time period, category, or dimension
- The query is the first question in the conversation
- You're uncertain whether the history has enough context
- If User Explicitly Asked to refetch data

Required Output Format:
DECISION: [SUFFICIENT or NEED_MORE_DATA]
REASONING: [Brief explanation of your decision]

Be conservative - when in doubt, choose NEED_MORE_DATA.`;

            const response = await this.lightAiService.generateContent(
                systemInstruction,
                prompt,
                0.0
            );

            // Parse the response
            const decisionMatch = response.match(/DECISION:\s*(SUFFICIENT|NEED_MORE_DATA)/i);
            const reasoningMatch = response.match(/REASONING:\s*(.+)/i);

            if (!decisionMatch) {
                logger.warn('Failed to parse context evaluation decision, defaulting to NEED_MORE_DATA');
                return {
                    decision: 'NEED_MORE_DATA',
                    reasoning: 'Failed to parse evaluation response',
                };
            }

            const decision = decisionMatch[1].toUpperCase() as 'SUFFICIENT' | 'NEED_MORE_DATA';
            const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided';

            logger.info(`Context evaluation: ${decision} - ${reasoning}`);

            return {
                decision,
                reasoning,
            };
        } catch (error) {
            logger.error('Error evaluating context:', error);
            // On error, default to NEED_MORE_DATA to ensure we don't skip necessary queries
            return {
                decision: 'NEED_MORE_DATA',
                reasoning: `Error during evaluation: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
}
