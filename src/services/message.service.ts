import { prisma } from "../lib/prisma.js";
import { getIO } from "../socket/index.js";
import { createConversationService } from "./conversation.service.js";
import { sendPushNotification } from "./push.service.js";
import { generatePresignedDownloadUrl } from "./storage.service.js";

// Helper check to see if user is part of conversation
export const checkUserInConversation = async (conversationId: string, userId: string) => {
    if (conversationId.startsWith('temp_')) {
        const recipientId = conversationId.replace('temp_', '');
        const recipient = await prisma.user.findUnique({
            where: { id: recipientId }
        });
        return !!recipient;
    }

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
    const nextCursor = hasMore ? reversedMessages[0]?.id : undefined;

    // Resolve presigned URLs for any attachments
    const messagesWithPresignedUrls = await Promise.all(reversedMessages.map(async (msg) => {
        if (msg.attachmentUrl) {
            try {
                // attachmentUrl stores the fileKey in this architecture
                const signedUrl = await generatePresignedDownloadUrl(msg.attachmentUrl);
                return { ...msg, attachmentUrl: signedUrl };
            } catch (err) {
                console.error(`Failed to generate presigned URL for msg ${msg.id}`, err);
                return msg;
            }
        }
        return msg;
    }));

    return {
        messages: messagesWithPresignedUrls,
        nextCursor,
        hasMore
    };
};

const resolveAttachmentAndBroadcast = async (newMessage: any, conversationId: string, senderId: string) => {
    // Resolve presigned URL if there is an attachment
    let returnedMessage = { ...newMessage };
    if (newMessage.attachmentUrl) {
        try {
            const signedUrl = await generatePresignedDownloadUrl(newMessage.attachmentUrl);
            returnedMessage.attachmentUrl = signedUrl;
        } catch (err) {
            console.error("Failed to generate signed URL for new message:", err);
        }
    }

    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId }
    });
    
    const io = getIO();
    participants.forEach((p) => {
        io.to(p.userId).emit("new_message", returnedMessage);
        if (p.userId !== senderId) {
            try {
                sendPushNotification(p.userId, {
                    title: `New message from ${newMessage.sender?.displayName}`,
                    body: newMessage.content,
                    data: { url: `/chat?chatId=${conversationId}` }
                });
            } catch (err) {
                console.error(`Failed to send push notification to ${p.userId}:`, err);
            }
        }
    });

    // Bump conversation updatedAt so sidebar sort by recency stays accurate
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return returnedMessage;
};

export const createMessage = async (
    conversationId: string, 
    senderId: string, 
    content: string | undefined,
    attachmentUrl?: string,
    attachmentType?: string,
    attachmentName?: string
) => {
    const isParticipant = await checkUserInConversation(conversationId, senderId);
    if (!isParticipant) {
        throw new Error("Unauthorized to access this conversation");
    }

    const newMessage = await prisma.message.create({
        data: {
            conversationId,
            senderId,
            content: content ?? null,
            attachmentUrl: attachmentUrl ?? null,
            attachmentType: attachmentType ?? null,
            attachmentName: attachmentName ?? null
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

    const returnedMessage = await resolveAttachmentAndBroadcast(newMessage, conversationId, senderId);

    return returnedMessage;
};

export const sendDirectMessageService = async (
    senderId: string, 
    recipientId: string, 
    content: string | undefined,
    attachmentUrl?: string,
    attachmentType?: string,
    attachmentName?: string
) => {
    // 1. Get or create the conversation (sender is guaranteed to be a participant)
    const { conversation } = await createConversationService(senderId, recipientId);

    // 2. Create message directly — skip checkUserInConversation since we just
    //    established participation above, avoiding a redundant DB round-trip.
    const newMessage = await prisma.message.create({
        data: { 
            conversationId: conversation.id, 
            senderId, 
            content: content ?? null,
            attachmentUrl: attachmentUrl ?? null,
            attachmentType: attachmentType ?? null,
            attachmentName: attachmentName ?? null
        },
        include: {
            sender: {
                select: { id: true, displayName: true, email: true },
            },
        },
    });

    const returnedMessage = await resolveAttachmentAndBroadcast(newMessage, conversation.id, senderId);

    return { conversation, message: returnedMessage };
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
        io.to(p.userId).emit("message_updated", updatedMessage);
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
        io.to(p.userId).emit("message_deleted", { messageId, conversationId: message.conversationId });
    });

    return true;
};

export const getMessageAttachmentUrlService = async (messageId: string, userId: string): Promise<string> => {
    const message = await prisma.message.findUnique({
        where: { id: messageId }
    });

    if (!message || !message.attachmentUrl) {
        throw new Error("Attachment not found");
    }

    const isParticipant = await checkUserInConversation(message.conversationId, userId);
    if (!isParticipant) {
        throw new Error("Unauthorized to access this conversation");
    }

    return await generatePresignedDownloadUrl(message.attachmentUrl);
};
