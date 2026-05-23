import type { Request, Response } from "express";
import { getConversationsForUser, createConversationService, markConversationAsRead } from "../services/conversation.service.js";
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
    } catch (error) {
        console.error("Error in createConversation:", error);
        return sendError(res, "Failed to create conversation", 500);
    }
};

export const markConversationRead = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: conversationId } = req.params;

        const { otherParticipantIds, readAt } = await markConversationAsRead(conversationId, userId);

        // Emit messages_read to the other participant(s) so they see blue checkmarks
        const io = getIO();
        otherParticipantIds.forEach((participantId) => {
            io.to(participantId).emit('messages_read', { conversationId, readBy: userId, readAt });
        });

        return sendSuccess(res, 'Conversation marked as read', null);
    } catch (error) {
        console.error('Error in markConversationRead:', error);
        return sendError(res, 'Failed to mark conversation as read');
    }
};