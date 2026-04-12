import type { Request, Response } from "express";
import { getConversationsForUser, createConversationService } from "../services/conversation.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getUserConversations = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const conversations = await getConversationsForUser(userId);

        return sendSuccess(res, "Conversations fetched successfully", conversations);
    } catch (error) {
        return sendError(res, "Failed to fetch conversations");
    }
};

export const createConversation = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user?.id;
        const { participantId } = req.body;

        if (!participantId) {
            return sendError(res, "participantId is required", 400);
        }

        const conversation = await createConversationService(
            currentUserId!,
            participantId
        );

        return sendSuccess(res, "Conversation created successfully", conversation, 200);
    } catch (error) {
        return sendError(res, "Failed to create conversation", 500);
    }
};