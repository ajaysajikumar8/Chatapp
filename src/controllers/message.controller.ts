import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import {
    getMessagesByConversationId,
    createMessage,
    updateMessageService,
    deleteMessageService,
    sendDirectMessageService,
    checkUserInConversation,
} from '../services/message.service.js';
import { generatePresignedUploadUrl } from '../services/storage.service.js';

export const getMessages = async (req: Request<{ conversationId: string }, any, any, { cursor?: string, limit?: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;
        const { cursor } = req.query;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

        const result = await getMessagesByConversationId(conversationId, userId, cursor, limit);
        sendSuccess(res, "Messages fetched successfully", result);
    } catch (error: any) {
        console.error("Error in getMessages:", error);
        sendError(res, error.message || 'Failed to fetch messages', error.message?.includes('Unauthorized') ? 403 : 500);
    }
};

export const getMessageById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    sendError(res, "Not implemented", 501);
};

export const generateUploadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const { conversationId, fileName, mimeType } = req.body || {};
        if (!conversationId || !fileName || !mimeType) {
            sendError(res, "conversationId, fileName and mimeType are required", 400);
            return;
        }

        const userId = req.user!.id;
        const isParticipant = await checkUserInConversation(conversationId, userId);
        if (!isParticipant) {
            sendError(res, "Unauthorized to access this conversation", 403);
            return;
        }

        const data = await generatePresignedUploadUrl(conversationId, fileName, mimeType);
        sendSuccess(res, "Presigned URL generated successfully", data, 200);
    } catch (error: any) {
        console.error("Error in generateUploadUrl:", error);
        sendError(res, error.message || 'Failed to generate upload URL', 500);
    }
};

export const sendMessage = async (req: Request<{ conversationId: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;
        const { content, attachmentUrl, attachmentType, attachmentName } = req.body || {};

        if (!content && !attachmentUrl) {
            sendError(res, "Content or attachment is required", 400);
            return;
        }

        const message = await createMessage(
            conversationId, 
            userId, 
            content, 
            attachmentUrl, 
            attachmentType, 
            attachmentName
        );
        sendSuccess(res, "Message sent successfully", message, 201);
    } catch (error: any) {
        console.error("Error in sendMessage:", error);
        sendError(res, error.message || 'Failed to send message', error.message?.includes('Unauthorized') ? 403 : 400);
    }
};

export const sendDirectMessage = async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
    try {
        const senderId = req.user!.id;
        const recipientId = req.params.userId;
        const { content, attachmentUrl, attachmentType, attachmentName } = req.body || {};

        if (!content && !attachmentUrl) {
            sendError(res, "Content or attachment is required", 400);
            return;
        }

        const result = await sendDirectMessageService(
            senderId, 
            recipientId, 
            content, 
            attachmentUrl, 
            attachmentType, 
            attachmentName
        );
        sendSuccess(res, "Message sent successfully", result, 201);
    } catch (error: any) {
        console.error("Error in sendDirectMessage:", error);
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

export const getDownloadUrl = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const { getMessageAttachmentUrlService } = await import('../services/message.service.js');
        const downloadUrl = await getMessageAttachmentUrlService(id, userId);
        sendSuccess(res, "Download URL generated successfully", { downloadUrl });
    } catch (error: any) {
        console.error("Error in getDownloadUrl:", error);
        sendError(res, error.message || 'Failed to get download URL', error.message?.includes('Unauthorized') ? 403 : 400);
    }
};