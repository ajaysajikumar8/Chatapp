import type { Request, Response } from "express";
import { getConversationsForUser, createConversationService, markConversationAsRead, muteConversationService, getConversationAttachmentsService } from "../services/conversation.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../socket/index.js";

export const getUserConversations = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const conversations = await getConversationsForUser(userId);

        return sendSuccess(res, "Conversations fetched successfully", conversations);
    } catch (error) {
        console.error("Error in getUserConversations:", error);
        return sendError(res, "Failed to fetch conversations");
    }
};

export const createConversation = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        const { participantId } = req.body || {};

        if (!participantId) {
            return sendError(res, "participantId is required", 400);
        }

        const { conversation, isNew } = await createConversationService(
            currentUserId!,
            participantId
        );

        if (isNew) {
            return sendSuccess(res, "Conversation created successfully", conversation, 201);
        }
        return sendSuccess(res, "Conversation already exists", conversation, 200);
    } catch (error: any) {
        console.error("Error in createConversation:", error);
        const errorMessage = error.message || "Failed to create conversation";
        const status = errorMessage.includes("start a conversation") ? 403 : 500;
        return sendError(res, errorMessage, status);
    }
};

export const markConversationRead = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: conversationId } = req.params;

        const { notifiedParticipantIds, readAt } = await markConversationAsRead(conversationId, userId);

        // Emit messages_read to eligible other participant(s) so they see blue checkmarks
        // Also emit to the user who read it to clear unread counts on their other devices
        const io = getIO();
        notifiedParticipantIds.forEach((participantId) => {
            io.to(participantId).emit('messages_read', { conversationId, readBy: userId, readAt });
        });
        io.to(userId).emit('messages_read', { conversationId, readBy: userId, readAt });

        sendSuccess(res, 'Conversation marked as read', null);
    } catch (error) {
        console.error('Error in markConversationRead:', error);
        sendError(res, 'Failed to mark conversation as read');
    }
};

export const muteConversation = async (req: Request<{ id: string }>, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id: conversationId } = req.params;
        const { duration } = req.body || {};

        if (!duration || typeof duration !== 'string') {
            return sendError(res, "duration is required and must be a string", 400);
        }

        const participant = await muteConversationService(conversationId, userId, duration);

        // Emit conversation_mute_changed to the user room so all active tabs sync immediately
        const io = getIO();
        io.to(userId).emit("conversation_mute_changed", {
            conversationId,
            mutedUntil: participant.mutedUntil ? participant.mutedUntil.toISOString() : null,
        });

        return sendSuccess(res, "Conversation mute status updated successfully", participant);
    } catch (error: any) {
        console.error("Error in muteConversation:", error);
        return sendError(res, error.message || "Failed to update mute status");
    }
};

export const getConversationAttachments = async (req: Request<{ id: string }>, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id: conversationId } = req.params;
        const type = req.query.type as string;
        const cursor = req.query.cursor as string | undefined;
        const limitStr = req.query.limit as string | undefined;

        if (type !== 'media' && type !== 'document') {
            return sendError(res, "type query parameter must be 'media' or 'document'", 400);
        }

        const limit = limitStr ? parseInt(limitStr, 10) : 20;

        const result = await getConversationAttachmentsService(conversationId, userId, type, cursor, limit);
        return sendSuccess(res, "Shared attachments fetched successfully", result);
    } catch (error: any) {
        console.error("Error in getConversationAttachments:", error);
        if (error.message.includes("Unauthorized")) {
            return sendError(res, error.message, 403);
        }
        return sendError(res, "Failed to fetch shared attachments");
    }
};