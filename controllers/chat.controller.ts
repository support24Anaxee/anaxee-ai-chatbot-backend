import { Request, Response } from 'express';
import * as chatService from '../services/chat.service';
import { sendSuccess, sendError, asyncHandler } from '../utils/response';
import { ValidationError } from '../utils/errors';

export const createChat = asyncHandler(async (req: Request, res: Response) => {
    const { userId, topic, projectSlug } = req.body;
    if (!userId || !projectSlug) {
        throw new ValidationError('UserId, and projectSlug are required');
    }

    const newChat = await chatService.createChat(userId, projectSlug, topic);
    sendSuccess(res, 'Chat created successfully', newChat, 201);
});

export const getChats = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.query.userId as string);
    if (isNaN(userId)) {
        throw new ValidationError('Valid userId is required');
    }

    const chats = await chatService.getChats(userId);
    sendSuccess(res, 'Chats retrieved successfully', chats);
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
    const chatId = parseInt(req.params.chatId);
    if (isNaN(chatId)) {
        throw new ValidationError('Valid chatId is required');
    }

    const messages = await chatService.getMessages(chatId);
    sendSuccess(res, 'Messages retrieved successfully', messages);
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const chatId = parseInt(req.params.chatId);
    const { content, role } = req.body; // role should be 'user' usually

    if (isNaN(chatId) || !content) {
        throw new ValidationError('Valid chatId and content are required');
    }

    // Save user message
    const userMessage = await chatService.sendMessage(chatId, content, role || 'user');

    // Trigger AI response (async or await depending on requirement, usually await for chat interface)
    // The user asked for "in return it will generate next message for me"
    const aiMessage = await chatService.processAiResponse(chatId);

    sendSuccess(res, 'Message sent successfully', { userMessage, aiMessage }, 201);
});

export const streamMessage = asyncHandler(async (req: Request, res: Response) => {
    const chatId = parseInt(req.params.chatId);
    const { content, role } = req.body;

    if (isNaN(chatId) || !content) {
        throw new ValidationError('Valid chatId and content are required');
    }

    // Save user message
    const userMessage = await chatService.sendMessage(chatId, content, role || 'user');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial user message event
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`);

    try {
        // Stream AI response
        for await (const event of chatService.processAiResponseStream(chatId)) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.end();
    } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: (error as Error).message })}\n\n`);
        res.end();
    }
});
