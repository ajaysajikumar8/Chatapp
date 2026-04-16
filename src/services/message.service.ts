import { prisma } from "../lib/prisma.js";

// Helper check to see if user is part of conversation
export const checkUserInConversation = async (conversationId: string, userId: string) => {
    const participant = await prisma.conversationParticipant.findUnique({
        where: {
            conversationId_userId: {
                conversationId,
                userId,
            },
        },
    });
    return !!participant;
};

export const getMessagesByConversationId = async (conversationId: string, userId: string) => {
    const isParticipant = await checkUserInConversation(conversationId, userId);
    if (!isParticipant) {
        throw new Error("Unauthorized to access this conversation");
    }

    return await prisma.message.findMany({
        where: {
            conversationId,
        },
        include: {
            sender: {
                select: {
                    id: true,
                    displayName: true,
                    email: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc", 
        },
    });
};

export const createMessage = async (conversationId: string, senderId: string, content: string) => {
    const isParticipant = await checkUserInConversation(conversationId, senderId);
    if (!isParticipant) {
        throw new Error("Unauthorized to access this conversation");
    }

    return await prisma.message.create({
        data: {
            conversationId,
            senderId,
            content,
        },
        include: {
            sender: {
                select: {
                    id: true,
                    displayName: true,
                    email: true,
                },
            },
        },
    });
};

export const updateMessageService = async (messageId: string, senderId: string, content: string) => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
    });

    if (!message) {
        throw new Error("Message not found");
    }

    if (message.senderId !== senderId) {
        throw new Error("Unauthorized to edit this message");
    }

    return await prisma.message.update({
        where: { id: messageId },
        data: { content },
        include: {
            sender: {
                select: {
                    id: true,
                    displayName: true,
                },
            },
        },
    });
};

export const deleteMessageService = async (messageId: string, senderId: string) => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
    });

    if (!message) {
        throw new Error("Message not found");
    }

    if (message.senderId !== senderId) {
        throw new Error("Unauthorized to delete this message");
    }

    await prisma.message.delete({
        where: { id: messageId },
    });

    return true;
};
