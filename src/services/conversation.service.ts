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

    if (currentUserId === participantId) {
        throw new Error("Cannot create conversation with yourself");
    }

    const existingConversation = await prisma.conversation.findFirst({
        where: {
            participants: {
                every: {
                    userId: {
                        in: [currentUserId, participantId],
                    },
                },
            },
        },
        include: {
            participants: true,
        },
    });

    if (
        existingConversation &&
        existingConversation.participants.length === 2
    ) {
        return existingConversation;
    }


    const newConversation = await prisma.conversation.create({
        data: {
            participants: {
                create: [
                    { userId: currentUserId },
                    { userId: participantId },
                ],
            },
        },
        include: {
            participants: true,
        },
    });

    return newConversation;
};