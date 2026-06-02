import { prisma } from "../lib/prisma.js";

export const getConversationsForUser = async (userId: string) => {
    const conversations = await prisma.conversation.findMany({
        where: {
            participants: {
                some: { userId },
            },
        },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            displayName: true,
                            email: true,
                            status: true,
                            lastSeen: true,
                        },
                    },
                },
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    // Fetch unread counts for all these conversations in a single raw query
    // This avoids the N+1 query problem
    const unreadCountsRaw = await prisma.$queryRaw<{ conversation_id: string; count: bigint }[]>`
        SELECT m."conversation_id", COUNT(m.id) as count
        FROM "messages" m
        JOIN "conversation_participants" p ON m."conversation_id" = p."conversation_id" AND p."user_id" = ${userId}
        WHERE (m."sender_id" != ${userId} OR m."sender_id" IS NULL)
        AND m."created_at" > p."last_read_at"
        GROUP BY m."conversation_id"
    `;

    const unreadCountsMap = new Map(
        unreadCountsRaw.map(row => [row.conversation_id, Number(row.count)])
    );

    const conversationsWithUnread = conversations.map(conv => ({
        ...conv,
        unreadCount: unreadCountsMap.get(conv.id) || 0
    }));

    return conversationsWithUnread;
};

export const createConversationService = async (
    currentUserId: string,
    participantId: string
) => {
    const isSelfConversation = currentUserId === participantId;
    const expectedParticipantCount = isSelfConversation ? 1 : 2;

    const includeQuery = {
        participants: {
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        status: true,
                        lastSeen: true,
                        username: true,
                    },
                },
            },
        },
        messages: {
            orderBy: {
                createdAt: "desc" as const,
            },
            take: 1,
        },
    };

    const existingConversations = await prisma.conversation.findMany({
        where: {
            AND: [
                {
                    participants: {
                        some: {
                            userId: currentUserId,
                        },
                    },
                },
                {
                    participants: {
                        some: {
                            userId: participantId,
                        },
                    },
                },
            ],
        },
        include: includeQuery,
    });

    const exactMatch = existingConversations.find(
        (c) => c.participants.length === expectedParticipantCount
    );

    if (exactMatch) {
        return { conversation: exactMatch, isNew: false };
    }

    const participantData = isSelfConversation
        ? [{ userId: currentUserId }]
        : [{ userId: currentUserId }, { userId: participantId }];

    const newConversation = await prisma.conversation.create({
        data: {
            participants: {
                create: participantData,
            },
        },
        include: includeQuery,
    });

    return { conversation: newConversation, isNew: true };
};

export const markConversationAsRead = async (conversationId: string, userId: string) => {
    const readAt = new Date();
    // Update this user's lastReadAt timestamp — the core of the sync token pattern
    await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: readAt },
    });

    // Notify the other participant(s) so they can show blue read checkmarks
    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
    });

    return {
        otherParticipantIds: participants
            .filter((p) => p.userId !== userId)
            .map((p) => p.userId),
        readAt: readAt.toISOString(),
    };
};