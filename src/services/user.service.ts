import { prisma } from "../lib/prisma.js";

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

    return await prisma.user.findMany({
        where: {
            id: {
                notIn: excludedIds,
            },
            isDiscoverable: true,
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
            id: true,
            displayName: true,
            username: true,
            email: true,
        },
        take: 20, // Add simple pagination/limit
    });
};
