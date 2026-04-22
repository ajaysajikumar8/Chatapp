import type { Request, Response } from "express";
import { searchUsersService } from "../services/user.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const searchUsers = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user!.id; // provided by authMiddleware
        const query = req.query.q as string;

        if (!query || query.trim().length === 0) {
            // Return empty array if no query provided
            return sendSuccess(res, "Search results", []);
        }

        const users = await searchUsersService(query.trim(), currentUserId);
        return sendSuccess(res, "Search results", users);
    } catch (error: any) {
        console.error("Error in searchUsers:", error);
        return sendError(res, "Failed to search users", 500);
    }
};
