import { prisma } from "../lib/prisma.js";

export const getConversationsForUser = async (userId: string) => {
    const conversations = await prisma.conversation.findMany({
        where: {
            participants: {
                some: {
                    userId: userId,
                },
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
                        },
                    },
                },
            },
            messages: {
                orderBy: {
                    createdAt: "desc",
                },
                take: 1, // last message only
            },
        },
        orderBy: {
            messages: {
                _count: "desc", // fallback sort
            },
        },
    });

    return conversations;
};

export const createConversationService = async (
    currentUserId: string,
    participantId: string
) => {
    const isSelfConversation = currentUserId === participantId;
    const expectedParticipantCount = isSelfConversation ? 1 : 2;

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
        include: {
            participants: true,
        },
    });

    const exactMatch = existingConversations.find(
        (c) => c.participants.length === expectedParticipantCount
    );

    if (exactMatch) {
        return exactMatch;
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
        include: {
            participants: true,
        },
    });

    return newConversation;
};