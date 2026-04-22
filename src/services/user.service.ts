import { prisma } from "../lib/prisma.js";

/**
 * Search users by displayName or email.
 * Excludes the currently authenticated user.
 */
export const searchUsersService = async (query: string, currentUserId: string) => {
    return await prisma.user.findMany({
        where: {
            id: {
                not: currentUserId,
            },
            OR: [
                {
                    displayName: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
                {
                    email: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
            ],
        },
        select: {
            id: true,
            displayName: true,
            email: true,
            // Exclude passwordHash, createdAt, updatedAt, deletedAt
        },
        take: 20, // Add simple pagination/limit
    });
};
