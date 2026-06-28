import type { Request, Response } from "express";
import { 
    searchUsersService, 
    getUserProfileAndSettings, 
    updateUserProfile, 
    updateUserSettings, 
    blockUser, 
    unblockUser, 
    getBlockedUsers,
    getTargetUserProfile
} from "../services/user.service.js";
import { 
    generatePresignedAvatarUploadUrl, 
    generatePresignedDownloadUrl,
    deleteFileFromR2
} from "../services/storage.service.js";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../socket/index.js";
import { isProductionSafeguardsEnabled } from "../middleware/rateLimit.middleware.js";

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

export const getMyProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const profileAndSettings = await getUserProfileAndSettings(userId);
        return sendSuccess(res, "Profile and settings retrieved successfully", profileAndSettings);
    } catch (error: any) {
        console.error("Error in getMyProfile:", error);
        return sendError(res, error.message || "Failed to retrieve profile", 500);
    }
};

export const updateMyProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { displayName, username, bio } = req.body;

        const updated = await updateUserProfile(userId, { displayName, username, bio });
        return sendSuccess(res, "Profile updated successfully", updated);
    } catch (error: any) {
        console.error("Error in updateMyProfile:", error);
        if (error.message === "Username already taken") {
            return sendError(res, error.message, 400);
        }
        return sendError(res, "Failed to update profile", 500);
    }
};

export const updateMySettings = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { 
            isDiscoverable, 
            readReceiptsEnabled, 
            lastSeenVisibility, 
            profilePhotoVisibility, 
            notificationsEnabled, 
            notificationSoundEnabled 
        } = req.body;

        const updated = await updateUserSettings(userId, {
            isDiscoverable,
            readReceiptsEnabled,
            lastSeenVisibility,
            profilePhotoVisibility,
            notificationsEnabled,
            notificationSoundEnabled
        });
        return sendSuccess(res, "Settings updated successfully", updated);
    } catch (error: any) {
        console.error("Error in updateMySettings:", error);
        return sendError(res, "Failed to update settings", 500);
    }
};

export const requestAvatarUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { extension, mimeType, fileSize } = req.body;

        if (!extension || !mimeType) {
            return sendError(res, "Extension and mimeType are required", 400);
        }


        // Validate MIME type is ALWAYS checked (all the times)
        if (!mimeType.toLowerCase().startsWith("image/")) {
            return sendError(res, "Only image files are allowed for profile avatars.", 400);
        }

        if (isProductionSafeguardsEnabled) {
            if (typeof fileSize !== "number") {
                return sendError(res, "fileSize (number in bytes) is required.", 400);
            }

            // 1. Validate avatar size (default 2MB)
            const maxAvatarSize = process.env.MAX_AVATAR_SIZE_BYTES ? parseInt(process.env.MAX_AVATAR_SIZE_BYTES, 10) : 2 * 1024 * 1024;
            if (fileSize > maxAvatarSize) {
                return sendError(res, `Avatar photo exceeds the maximum size of ${Math.round(maxAvatarSize / (1024 * 1024))}MB allowed for this public demo.`, 400);
            }
        }

        const data = await generatePresignedAvatarUploadUrl(userId, extension, mimeType, isProductionSafeguardsEnabled ? fileSize : undefined);
        return sendSuccess(res, "Presigned upload URL generated successfully", data);
    } catch (error: any) {
        console.error("Error in requestAvatarUpload:", error);
        return sendError(res, error.message || "Failed to request upload URL", 500);
    }
};

export const completeAvatarUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { fileKey } = req.body;

        if (!fileKey) {
            return sendError(res, "fileKey is required", 400);
        }

        const currentProfile = await prisma.userProfile.findUnique({
            where: { userId },
            select: { profilePhotoUrl: true }
        });
        const oldFileKey = currentProfile?.profilePhotoUrl;

        await prisma.userProfile.update({
            where: { userId },
            data: { profilePhotoUrl: fileKey }
        });

        if (oldFileKey && oldFileKey !== fileKey && oldFileKey.startsWith("users/")) {
            await deleteFileFromR2(oldFileKey);
        }

        const downloadUrl = await generatePresignedDownloadUrl(fileKey);

        return sendSuccess(res, "Avatar uploaded successfully", { fileKey, avatarUrl: downloadUrl });
    } catch (error: any) {
        console.error("Error in completeAvatarUpload:", error);
        return sendError(res, "Failed to complete avatar upload", 500);
    }
};
export const blockUserHandler = async (req: Request, res: Response) => {
    try {
        const blockerId = req.user!.id;
        const { userId } = req.params;
        if (!userId || typeof userId !== 'string') {
            return sendError(res, "Invalid user ID", 400);
        }

        await blockUser(blockerId, userId);

        try {
            const io = getIO();
            io.to(userId).emit("block_status_changed", { userId: blockerId, isBlockedByThem: true });
            io.to(userId).emit("user_presence_changed", { userId: blockerId, status: "OFFLINE", lastSeen: null });
        } catch (socketErr) {
            console.error("Error emitting block socket events:", socketErr);
        }

        return sendSuccess(res, "User blocked successfully", null);
    } catch (error: any) {
        console.error("Error in blockUserHandler:", error);
        if (error.message === "Cannot block yourself" || error.message === "User to block does not exist") {
            return sendError(res, error.message, 400);
        }
        return sendError(res, "Failed to block user", 500);
    }
};

export const unblockUserHandler = async (req: Request, res: Response) => {
    try {
        const blockerId = req.user!.id;
        const { userId } = req.params;
        if (!userId || typeof userId !== 'string') {
            return sendError(res, "Invalid user ID", 400);
        }

        await unblockUser(blockerId, userId);

        try {
            const io = getIO();
            io.to(userId).emit("block_status_changed", { userId: blockerId, isBlockedByThem: false });
        } catch (socketErr) {
            console.error("Error emitting unblock socket events:", socketErr);
        }

        return sendSuccess(res, "User unblocked successfully", null);
    } catch (error: any) {
        console.error("Error in unblockUserHandler:", error);
        if (error.message === "Block relation not found") {
            return sendError(res, error.message, 404);
        }
        return sendError(res, "Failed to unblock user", 500);
    }
};

export const getBlockedUsersHandler = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const blockedUsers = await getBlockedUsers(userId);
        return sendSuccess(res, "Blocked users list retrieved successfully", blockedUsers);
    } catch (error: any) {
        console.error("Error in getBlockedUsersHandler:", error);
        return sendError(res, "Failed to retrieve blocked users list", 500);
    }
};

export const getUserProfileHandler = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user!.id;
        const { userId } = req.params;

        if (!userId || typeof userId !== 'string') {
            return sendError(res, "Invalid user ID", 400);
        }

        const profile = await getTargetUserProfile(currentUserId, userId);
        return sendSuccess(res, "User profile retrieved successfully", profile);
    } catch (error: any) {
        console.error("Error in getUserProfileHandler:", error);
        if (error.message === "User not found") {
            return sendError(res, error.message, 404);
        }
        return sendError(res, "Failed to retrieve user profile", 500);
    }
};
