import { prisma } from "../lib/prisma.js";
import { getIO } from "../socket/index.js";

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

    const newMessage = await prisma.message.create({
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

    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId }
    });
    
    const io = getIO();
    participants.forEach((p) => {
        if (p.userId !== senderId) {
            io.to(p.userId).emit("new_message", newMessage);
        }
    });

    return newMessage;
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

    const updatedMessage = await prisma.message.update({
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

    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: message.conversationId }
    });
    
    const io = getIO();
    participants.forEach((p) => {
        if (p.userId !== senderId) {
            io.to(p.userId).emit("message_updated", updatedMessage);
        }
    });

    return updatedMessage;
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

    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: message.conversationId }
    });
    
    const io = getIO();
    participants.forEach((p) => {
        if (p.userId !== senderId) {
            io.to(p.userId).emit("message_deleted", { messageId, conversationId: message.conversationId });
        }
    });

    return true;
};
