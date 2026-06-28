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
import { isProductionSafeguardsEnabled } from '../middleware/rateLimit.middleware.js';

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
        const { conversationId, fileName, mimeType, fileSize } = req.body || {};
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


        // 1. Validate MIME type (Always active, even in development)
        const allowedTypesEnv = process.env.ALLOWED_FILE_TYPES || "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,application/pdf,text/plain";
        const allowedTypes = allowedTypesEnv.split(",").map(t => t.trim().toLowerCase());
        if (!allowedTypes.includes(mimeType.toLowerCase())) {
            sendError(res, "This file type is not supported.", 400);
            return;
        }

        if (isProductionSafeguardsEnabled) {
            if (typeof fileSize !== "number") {
                sendError(res, "fileSize (number in bytes) is required.", 400);
                return;
            }

            // 2. Validate max file size
            const maxFileSize = process.env.MAX_FILE_SIZE_BYTES ? parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) : 10 * 1024 * 1024; // default 10MB
            if (fileSize > maxFileSize) {
                sendError(res, `File exceeds the maximum size of ${Math.round(maxFileSize / (1024 * 1024))}MB allowed for this public demo.`, 400);
                return;
            }

            // 3. Validate total storage quota per user
            const maxStorage = process.env.MAX_STORAGE_PER_USER_BYTES ? parseInt(process.env.MAX_STORAGE_PER_USER_BYTES, 10) : 50 * 1024 * 1024; // default 50MB
            const prismaImport = await import("../lib/prisma.js");
            const db = prismaImport.prisma;
            const messagesWithAttachments = await db.message.findMany({
                where: {
                    senderId: userId,
                    attachmentUrl: { not: null },
                    attachmentSize: { not: null }
                },
                select: {
                    attachmentSize: true
                }
            });
            const totalUsed = messagesWithAttachments.reduce((sum, msg) => sum + (msg.attachmentSize || 0), 0);
            if (totalUsed + fileSize > maxStorage) {
                sendError(res, `You have reached your storage limit of ${Math.round(maxStorage / (1024 * 1024))}MB for this public demo. Please delete older messages/files to free up space.`, 400);
                return;
            }
        }

        const data = await generatePresignedUploadUrl(conversationId, fileName, mimeType, isProductionSafeguardsEnabled ? fileSize : undefined);
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
        const { content, attachmentUrl, attachmentType, attachmentName, attachmentSize } = req.body || {};

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
            attachmentName,
            attachmentSize
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
        const { content, attachmentUrl, attachmentType, attachmentName, attachmentSize } = req.body || {};

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
            attachmentName,
            attachmentSize
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

export const deleteMessage = async (req: Request<{ id: string }, any, any, { type?: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const type = (req.query.type === 'me' ? 'me' : 'everyone') as 'me' | 'everyone';

        const result = await deleteMessageService(id, userId, type);
        sendSuccess(res, "Message deleted successfully", result);
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