import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIModelConfig } from '../../types/sql-assistant.types';
import { AIServiceError } from '../../types/errors';
import logger from '../../utils/logger';

/**
 * AI service for interacting with AI providers (Gemini/Groq)
 */
export class AIService {
    private client: any;
    private config: AIModelConfig;
    private lastTokenUsage: any = null;

    constructor(config: AIModelConfig) {
        this.config = config;
        this.initializeClient();
    }

    /**
     * Initialize AI client based on provider
     */
    private initializeClient(): void {
        try {
            if (this.config.provider === AIProvider.GEMINI) {
                this.client = new GoogleGenAI({
                    apiKey: process.env.GEMINI_API_KEY || '',
                });
                logger.info(`Initialized Gemini client with model ${this.config.model}`);
            } else {
                throw new AIServiceError(`Unsupported AI provider: ${this.config.provider}`);
            }
        } catch (error) {
            logger.error('Failed to initialize AI client:', error);
            throw new AIServiceError(
                `Failed to initialize AI client: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Generate content using AI
     */
    async generateContent(
        systemInstruction: string,
        prompt: string,
        temperature?: number
    ): Promise<string> {
        try {
            const response = await this.client.models.generateContent({
                model: this.config.model,
                config: {
                    systemInstruction,
                    temperature: temperature ?? this.config.temperature ?? 0.0,
                },
                contents: [prompt],
            });
            console.log(JSON.stringify(response.usageMetadata));

            // Store token usage
            this.lastTokenUsage = response.usageMetadata;

            return response.text;
        } catch (error) {
            logger.error('Error generating content:', error);
            throw new AIServiceError(
                `Failed to generate content: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Generate content with streaming
     */
    /**
     * Generate content with streaming
     */
    async *generateContentStream(
        systemInstruction: string,
        prompt: string,
        temperature?: number,
        tools?: any[]
    ): AsyncGenerator<any> {
        try {
            const response = await this.client.models.generateContentStream({
                model: this.config.model,
                config: {
                    systemInstruction,
                    temperature: temperature ?? this.config.temperature ?? 0.3,
                    tools: tools,
                },
                contents: [prompt],
            });

            for await (const chunk of response) {
                // Handle text content
                if (chunk.text) {
                    yield { type: 'text', content: chunk.text };
                }

                // Handle function calls
                const functionCalls = chunk.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                    for (const call of functionCalls) {
                        yield { type: 'function_call', name: call.name, args: call.args };
                    }
                }
            }
        } catch (error) {
            logger.error('Error generating content stream:', error);
            throw new AIServiceError(
                `Failed to generate content stream: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get last token usage metadata
     */
    getLastTokenUsage(): any {
        return this.lastTokenUsage;
    }
}
