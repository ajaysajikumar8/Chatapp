import { prisma } from "../lib/prisma.js";
import { generatePresignedDownloadUrl } from "./storage.service.js";

/**
 * Search users by displayName or username.
 * Excludes the currently authenticated user, blocked users, and non-discoverable users.
 */
export const searchUsersService = async (query: string, currentUserId: string) => {
    const blocks = await prisma.block.findMany({
        where: {
            OR: [
                { blockerId: currentUserId },
                { blockedId: currentUserId }
            ]
        }
    });

    const blockedUserIds = blocks.map(b => 
        b.blockerId === currentUserId ? b.blockedId : b.blockerId
    );

    const excludedIds = [...blockedUserIds, currentUserId];

    const profiles = await prisma.userProfile.findMany({
        where: {
            userId: {
                notIn: excludedIds,
            },
            user: {
                settings: {
                    isDiscoverable: true,
                }
            },
            OR: [
                {
                    displayName: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    username: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
            ],
        },
        select: {
            userId: true,
            displayName: true,
            username: true,
            profilePhotoUrl: true,
            user: {
                select: {
                    email: true,
                }
            }
        },
        take: 20, // Add simple pagination/limit
    });

    // Map to consistent format expected by frontend
    return await Promise.all(profiles.map(async p => {
        let avatarUrl = null;
        if (p.profilePhotoUrl) {
            try {
                avatarUrl = await generatePresignedDownloadUrl(p.profilePhotoUrl);
            } catch (err) {
                console.error("Error signing search result avatar", err);
            }
        }
        return {
            id: p.userId,
            displayName: p.displayName,
            username: p.username,
            email: p.user.email,
            avatarUrl,
        };
    }));
};

export const getUserProfileAndSettings = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            profile: true,
            settings: true
        }
    });

    if (!user) {
        throw new Error("User not found");
    }

    let avatarUrl = null;
    if (user.profile?.profilePhotoUrl) {
        try {
            avatarUrl = await generatePresignedDownloadUrl(user.profile.profilePhotoUrl);
        } catch (err) {
            console.error("Error signing avatar URL", err);
        }
    }

    return {
        profile: {
            displayName: user.profile?.displayName || "",
            username: user.profile?.username || "",
            bio: user.profile?.bio || "",
            profilePhotoUrl: user.profile?.profilePhotoUrl || null,
            avatarUrl,
        },
        settings: {
            isDiscoverable: user.settings?.isDiscoverable ?? true,
            readReceiptsEnabled: user.settings?.readReceiptsEnabled ?? true,
            lastSeenVisibility: user.settings?.lastSeenVisibility ?? "EVERYONE",
            profilePhotoVisibility: user.settings?.profilePhotoVisibility ?? "EVERYONE",
            notificationsEnabled: user.settings?.notificationsEnabled ?? true,
            notificationSoundEnabled: user.settings?.notificationSoundEnabled ?? true,
        }
    };
};

export const updateUserProfile = async (
    userId: string,
    data: { displayName?: string; username?: string; bio?: string }
) => {
    if (data.username) {
        // Check if username is already taken by another user
        const existing = await prisma.userProfile.findFirst({
            where: {
                username: data.username,
                NOT: { userId }
            }
        });
        if (existing) {
            throw new Error("Username already taken");
        }
    }

    const updateData: any = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.bio !== undefined) updateData.bio = data.bio;

    const updatedProfile = await prisma.userProfile.update({
        where: { userId },
        data: updateData
    });

    return updatedProfile;
};

export const updateUserSettings = async (
    userId: string,
    data: {
        isDiscoverable?: boolean;
        readReceiptsEnabled?: boolean;
        lastSeenVisibility?: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
        profilePhotoVisibility?: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
        notificationsEnabled?: boolean;
        notificationSoundEnabled?: boolean;
    }
) => {
    const updatedSettings = await prisma.userSettings.update({
        where: { userId },
        data
    });
    return updatedSettings;
};

export const blockUser = async (blockerId: string, blockedId: string) => {
    if (blockerId === blockedId) {
        throw new Error("Cannot block yourself");
    }
    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
        where: { id: blockedId }
    });
    if (!targetUser) {
        throw new Error("User to block does not exist");
    }

    const existingBlock = await prisma.block.findUnique({
        where: {
            blockerId_blockedId: { blockerId, blockedId }
        }
    });
    if (existingBlock) {
        return existingBlock;
    }
    return await prisma.block.create({
        data: { blockerId, blockedId }
    });
};

export const unblockUser = async (blockerId: string, blockedId: string) => {
    try {
        await prisma.block.delete({
            where: {
                blockerId_blockedId: { blockerId, blockedId }
            }
        });
        return true;
    } catch (err) {
        throw new Error("Block relation not found");
    }
};

export const getBlockedUsers = async (blockerId: string) => {
    const blocks = await prisma.block.findMany({
        where: { blockerId },
        include: {
            blocked: {
                include: {
                    profile: true
                }
            }
        }
    });

    return await Promise.all(blocks.map(async b => {
        let avatarUrl = null;
        if (b.blocked.profile?.profilePhotoUrl) {
            try {
                avatarUrl = await generatePresignedDownloadUrl(b.blocked.profile.profilePhotoUrl);
            } catch (err) {
                console.error("Error signing avatar URL", err);
            }
        }
        return {
            id: b.blocked.id,
            displayName: b.blocked.profile?.displayName || "",
            username: b.blocked.profile?.username || "",
            avatarUrl
        };
    }));
};

export const getTargetUserProfile = async (currentUserId: string, targetUserId: string) => {
    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
            profile: true,
            settings: true
        }
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    const blocks = await prisma.block.findMany({
        where: {
            OR: [
                { blockerId: currentUserId, blockedId: targetUserId },
                { blockerId: targetUserId, blockedId: currentUserId }
            ]
        }
    });

    const isBlockedByMe = blocks.some(b => b.blockerId === currentUserId);
    const isBlockedByThem = blocks.some(b => b.blockerId === targetUserId);

    // Check if they share a conversation (contacts by definition)
    const sharedConversation = await prisma.conversation.findFirst({
        where: {
            AND: [
                { participants: { some: { userId: currentUserId } } },
                { participants: { some: { userId: targetUserId } } }
            ]
        }
    });
    const isContact = !!sharedConversation;

    let avatarUrl = null;
    let status = "OFFLINE";
    let lastSeen: Date | null = null;
    let bio: string | null = null;

    if (!isBlockedByMe && !isBlockedByThem) {
        bio = targetUser.profile?.bio || "";

        // Profile Photo Visibility
        const photoVis = targetUser.settings?.profilePhotoVisibility ?? "EVERYONE";
        const canSeePhoto = photoVis === "EVERYONE" || (photoVis === "CONTACTS" && isContact);
        if (canSeePhoto && targetUser.profile?.profilePhotoUrl) {
            try {
                avatarUrl = await generatePresignedDownloadUrl(targetUser.profile.profilePhotoUrl);
            } catch (err) {
                console.error("Error signing target user avatar", err);
            }
        }

        // Last Seen Visibility
        const lastSeenVis = targetUser.settings?.lastSeenVisibility ?? "EVERYONE";
        const canSeeLastSeen = lastSeenVis === "EVERYONE" || (lastSeenVis === "CONTACTS" && isContact);
        if (canSeeLastSeen) {
            status = targetUser.profile?.status || "OFFLINE";
            lastSeen = targetUser.profile?.lastSeen || null;
        }
    }

    return {
        id: targetUser.id,
        displayName: targetUser.profile?.displayName || "",
        username: targetUser.profile?.username || "",
        bio,
        avatarUrl,
        status,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
        isBlockedByMe,
        isBlockedByThem
    };
};
