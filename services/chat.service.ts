import { eq, desc } from 'drizzle-orm';
import { db } from '../config/db.config';
import { chats } from '../models/chats';
import { projects } from '../models/projects';
import { messages } from '../models/messages';
import { spawn } from 'child_process';
import path from 'path';

import { getProjectBySlug, getProjectById } from './project.service';
import { NotFoundError } from '../utils/errors';
import genAiService from './genAi.service';
import logger from '../utils/logger';

export const createChat = async (userId: number, projectSlug: string, topic?: string) => {
    try {
        const project = await getProjectBySlug(projectSlug);
        if (!project) {
            throw new NotFoundError(`Project with slug '${projectSlug}' not found`);
        }
        if (!topic) {
            topic = 'new chat';
        }
        console.log(userId, topic, project.id);
        const [result] = await db.insert(chats).values({ userId, topic, projectId: project.id }).$returningId();
        return { id: result.id, userId, topic, projectId: project.id, projectSlug: project.slug };
    } catch (error) {
        throw error;
    }
};

export const getChats = async (userId: number) => {
    try {
        return await db.select({ ...chats, projectSlug: projects.slug }).from(chats).leftJoin(projects, eq(chats.projectId, projects.id)).where(eq(chats.userId, userId)).orderBy(desc(chats.createdAt));
    } catch (error) {
        throw error;
    }
};

export const getMessages = async (chatId: number) => {
    try {
        return await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.createdAt);
    } catch (error) {
        throw error;
    }
};

export const sendMessage = async (chatId: number, content: string, role: string, chartSpec?: string) => {
    try {
        const [result] = await db.insert(messages).values({ chatId, content, role, chartSpec }).$returningId();
        return { id: result.id, chatId, content, role, chartSpec };
    } catch (error) {
        throw error;
    }
};

export const processAiResponse = async (chatId: number) => {
    try {
        // 1. Fetch chat history
        const chatMessages = await getMessages(chatId);

        // 2. Prepare input for Python script
        const input = {
            messages: chatMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        };

        // 3. Get Project Script Name
        const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
        if (!chat) {
            throw new Error('Chat not found');
        }
        const project = await getProjectById(chat.projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // 4. Call Python script
        const scriptPath = path.join(__dirname, '../script/chat_interface.py');

        return new Promise((resolve, reject) => {
            // Pass script name as argument
            const pythonProcess = spawn('python3', [scriptPath, project.scriptName]);

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            pythonProcess.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`Python script exited with code ${code}`);
                    console.error(`Error output: ${errorData}`);
                    return reject(new Error(`Python script failed: ${errorData}`));
                }

                try {
                    const result = JSON.parse(outputData);
                    if (result.error) {
                        return reject(new Error(result.error));
                    }

                    const aiContent = result.response;

                    // 4. Save AI response
                    const savedMessage = await sendMessage(chatId, aiContent, 'assistant');
                    resolve(savedMessage);

                } catch (parseError) {
                    console.error('Failed to parse Python script output:', outputData);
                    reject(new Error('Failed to parse AI response'));
                }
            });

            // Send input to Python script
            pythonProcess.stdin.write(JSON.stringify(input));
            pythonProcess.stdin.end();
        });

    } catch (error) {
        throw error;
    }
};

export async function* processAiResponseStream(chatId: number) {
    try {
        // 1. Fetch chat history
        const chatMessages = await getMessages(chatId);


        // 2. Prepare input for Python script
        const input = {
            messages: chatMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        };

        // 3. Get Project Script Name
        const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
        if (!chat) {
            throw new Error('Chat not found');
        }
        const project = await getProjectById(chat.projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // 4. Call Python script with --stream flag
        const scriptPath = path.join(__dirname, '../script/chat_interface.py');
        const pythonProcess = spawn('python3', [scriptPath, project.scriptName, '--stream']);

        let fullResponse = '';
        let errorData = '';

        // Send input to Python script
        pythonProcess.stdin.write(JSON.stringify(input));
        pythonProcess.stdin.end();

        // Create promise to handle process completion
        const processComplete = new Promise<void>((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0 && !fullResponse) {
                    reject(new Error(`Python script failed: ${errorData}`));
                } else {
                    resolve();
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });
        });

        // Stream stdout line by line
        let buffer = '';
        for await (const chunk of pythonProcess.stdout) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const event = JSON.parse(line);

                    if (event.type === 'content') {
                        fullResponse += event.content;
                        yield { type: 'content', content: event.content };
                    } else if (event.type === 'status') {
                        yield { type: 'status', content: event.content };
                    } else if (event.type === 'metadata') {
                        yield { type: 'metadata', ...event };
                    } else if (event.type === 'error') {
                        throw new Error(event.content);
                    } else if (event.error) {
                        throw new Error(event.error);
                    }
                } catch (parseError) {
                    console.error('Failed to parse line:', line);
                }
            }
        }

        // Wait for process to complete
        await processComplete;

        // Save the complete AI response
        if (fullResponse) {
            if (chatMessages.length === 1) {
                try {
                    console.log(fullResponse, 'fullResponse');
                    const chatTitle = await genAiService.generateChatTitle(fullResponse);
                    if (chatTitle) {

                        await db.update(chats).set({ topic: chatTitle }).where(eq(chats.id, chatId));
                    }
                } catch (error) {
                    logger.error(error);
                }

            }
            await sendMessage(chatId, fullResponse, 'assistant');
            yield { type: 'done', messageId: chatId };
        }

    } catch (error) {
        console.error('Error in processAiResponseStream:', error);
        throw error;
    }
}
