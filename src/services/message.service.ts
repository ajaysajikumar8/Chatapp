import { prisma } from "../lib/prisma.js";
import { getIO } from "../socket/index.js";
import { createConversationService } from "./conversation.service.js";
import { sendPushNotification } from "./push.service.js";

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

export const getMessagesByConversationId = async (conversationId: string, userId: string, cursor?: string, limit: number = 50) => {
    const isParticipant = await checkUserInConversation(conversationId, userId);
    if (!isParticipant) {
        throw new Error("Unauthorized to access this conversation");
    }

    const take = limit + 1;

    const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
            sender: {
                select: { id: true, displayName: true, email: true },
            },
        },
        take,
        ...(cursor && {
            skip: 1,
            cursor: { id: cursor },
        }),
        orderBy: {
            createdAt: "desc",
        },
    });

    const hasMore = messages.length > limit;
    const paginatedMessages = hasMore ? messages.slice(0, limit) : messages;

    // Prisma returns newest first (desc). We want oldest first (asc) for UI.
    const reversedMessages = paginatedMessages.reverse();
    
    // The oldest message in this batch will be the cursor for the next batch
    // Because we reversed it, it's the first element in the reversed array
    const nextCursor = hasMore ? reversedMessages[0].id : undefined;

    return {
        messages: reversedMessages,
        nextCursor,
        hasMore
    };
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
            sendPushNotification(p.userId, {
                title: `New message from ${newMessage.sender?.displayName}`,
                body: newMessage.content,
                data: { url: `/chat?chatId=${conversationId}` }
            });
        }
    });

    // Bump conversation updatedAt so sidebar sort by recency stays accurate
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return newMessage;
};

export const sendDirectMessageService = async (senderId: string, recipientId: string, content: string) => {
    // 1. Get or create the conversation (sender is guaranteed to be a participant)
    const { conversation } = await createConversationService(senderId, recipientId);

    // 2. Create message directly — skip checkUserInConversation since we just
    //    established participation above, avoiding a redundant DB round-trip.
    const newMessage = await prisma.message.create({
        data: { conversationId: conversation.id, senderId, content },
        include: {
            sender: {
                select: { id: true, displayName: true, email: true },
            },
        },
    });

    // 3. Emit new_message to all other participants
    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: conversation.id },
    });
    const io = getIO();
    participants.forEach((p) => {
        if (p.userId !== senderId) {
            io.to(p.userId).emit('new_message', newMessage);
            sendPushNotification(p.userId, {
                title: `New message from ${newMessage.sender?.displayName}`,
                body: newMessage.content,
                data: { url: `/chat?chatId=${conversation.id}` }
            });
        }
    });

    // 4. Update conversation updatedAt so sidebar sort stays accurate
    await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
    });

    return { conversation, message: newMessage };
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
