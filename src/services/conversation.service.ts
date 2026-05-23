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

    // Compute unread count for each conversation using the lastReadAt sync token
    const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
            const myParticipant = conv.participants.find((p) => p.userId === userId);
            const lastReadAt = myParticipant?.lastReadAt ?? new Date(0);

            const unreadCount = await prisma.message.count({
                where: {
                    conversationId: conv.id,
                    senderId: { not: userId },
                    createdAt: { gt: lastReadAt },
                },
            });

            return { ...conv, unreadCount };
        })
    );

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