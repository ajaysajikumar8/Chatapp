import type { Request, Response } from "express";
import { getConversationsForUser, createConversationService } from "../services/conversation.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

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