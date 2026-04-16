import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import {
    getMessagesByConversationId,
    createMessage,
    updateMessageService,
    deleteMessageService,
} from '../services/message.service.js';

export const getMessages = async (req: Request<{ conversationId: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;

        const messages = await getMessagesByConversationId(conversationId, userId);
        sendSuccess(res, "Messages fetched successfully", messages);
    } catch (error: any) {
        console.error("Error in getMessages:", error);
        sendError(res, error.message || 'Failed to fetch messages', error.message?.includes('Unauthorized') ? 403 : 500);
    }
};

export const getMessageById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    sendError(res, "Not implemented", 501);
};

export const sendMessage = async (req: Request<{ conversationId: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;
        const { content } = req.body || {};

        if (!content) {
            sendError(res, "Content is required", 400);
            return;
        }

        const message = await createMessage(conversationId, userId, content);
        sendSuccess(res, "Message sent successfully", message, 201);
    } catch (error: any) {
        console.error("Error in sendMessage:", error);
        sendError(res, error.message || 'Failed to send message', error.message?.includes('Unauthorized') ? 403 : 400);
    }
};

export const updateMessage = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { content } = req.body || {};

        if (!content) {
            sendError(res, "Content is required", 400);
            return;
        }

        const message = await updateMessageService(id, userId, content);
        sendSuccess(res, "Message updated successfully", message);
    } catch (error: any) {
        console.error("Error in updateMessage:", error);
        sendError(res, error.message || 'Failed to update message', error.message?.includes('Unauthorized') ? 403 : 400);
    }
};

export const deleteMessage = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        await deleteMessageService(id, userId);
        sendSuccess(res, "Message deleted successfully", null);
    } catch (error: any) {
        console.error("Error in deleteMessage:", error);
        sendError(res, error.message || 'Failed to delete message', error.message?.includes('Unauthorized') ? 403 : 400);
    }
};