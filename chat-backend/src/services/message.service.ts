import { prisma } from "../lib/prisma.js";
import { getIO } from "../socket/index.js";
import { createConversationService } from "./conversation.service.js";
import { sendPushNotification } from "./push.service.js";
import { generatePresignedDownloadUrl, deleteFileFromR2 } from "./storage.service.js";

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
        where: { 
            conversationId,
            deletedForUsers: {
                none: {
                    userId
                }
            }
        },
        include: {
            sender: {
                select: {
                    id: true,
                    email: true,
                    profile: {
                        select: {
                            displayName: true,
                            username: true,
                            profilePhotoUrl: true,
                        }
                    }
                },
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

    const blocks = await prisma.block.findMany({
        where: { blockedId: userId }
    });
    const blockingMeUserIds = new Set(blocks.map(b => b.blockerId));

    const messagesMapped = messagesWithPresignedUrls.map(msg => {
        const flattened = flattenMessageSender(msg);
        if (flattened.sender && blockingMeUserIds.has(flattened.sender.id)) {
            flattened.sender.profilePhotoUrl = null;
            flattened.sender.avatarUrl = null;
        }
        return flattened;
    });

    return {
        messages: messagesMapped,
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
            const isMuted = p.mutedUntil && new Date(p.mutedUntil) > new Date();
            if (!isMuted) {
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
        }
    });

    // Bump conversation updatedAt so sidebar sort by recency stays accurate
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });

    return returnedMessage;
};

const flattenMessageSender = (msg: any) => {
    if (!msg || !msg.sender) return msg;
    const userProfile = msg.sender.profile;
    return {
        ...msg,
        sender: {
            id: msg.sender.id,
            email: msg.sender.email || "",
            displayName: userProfile?.displayName || "",
            username: userProfile?.username || "",
            profilePhotoUrl: userProfile?.profilePhotoUrl || null,
        }
    };
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

    // Check if any block exists between sender and other participants
    const otherParticipants = await prisma.conversationParticipant.findMany({
        where: {
            conversationId,
            userId: { not: senderId }
        }
    });

    const otherUserIds = otherParticipants.map(p => p.userId);

    if (otherUserIds.length > 0) {
        const blockExists = await prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: senderId, blockedId: { in: otherUserIds } },
                    { blockerId: { in: otherUserIds }, blockedId: senderId }
                ]
            }
        });

        if (blockExists) {
            throw new Error("You cannot send messages to this user.");
        }
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
                    email: true,
                    profile: {
                        select: {
                            displayName: true,
                            username: true,
                            profilePhotoUrl: true,
                        }
                    }
                },
            },
        },
    });

    const returnedMessage = await resolveAttachmentAndBroadcast(flattenMessageSender(newMessage), conversationId, senderId);

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
    // Check if either user has blocked the other
    const blockExists = await prisma.block.findFirst({
        where: {
            OR: [
                { blockerId: senderId, blockedId: recipientId },
                { blockerId: recipientId, blockedId: senderId }
            ]
        }
    });

    if (blockExists) {
        throw new Error("You cannot send messages to this user.");
    }

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
                select: {
                    id: true,
                    email: true,
                    profile: {
                        select: {
                            displayName: true,
                            username: true,
                            profilePhotoUrl: true,
                        }
                    }
                },
            },
        },
    });

    const returnedMessage = await resolveAttachmentAndBroadcast(flattenMessageSender(newMessage), conversation.id, senderId);

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

    if (message.isDeleted) {
        throw new Error("Cannot edit a deleted message");
    }

    // Verify time limit (15 minutes)
    const timeDiff = Date.now() - new Date(message.createdAt).getTime();
    if (timeDiff > 15 * 60 * 1000) {
        throw new Error("Edit window has expired (15 minutes)");
    }

    const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { 
            content,
            isEdited: true,
            updatedAt: new Date()
        },
        include: {
            sender: {
                select: {
                    id: true,
                    email: true,
                    profile: {
                        select: {
                            displayName: true,
                            username: true,
                            profilePhotoUrl: true,
                        }
                    }
                },
            },
        },
    });

    const flattened = flattenMessageSender(updatedMessage);

    const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: message.conversationId }
    });
    
    const io = getIO();
    participants.forEach((p) => {
        io.to(p.userId).emit("message_updated", flattened);
    });

    return flattened;
};

export const deleteMessageService = async (messageId: string, userId: string, type: 'me' | 'everyone' = 'everyone') => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
    });

    if (!message) {
        throw new Error("Message not found");
    }

    if (type === 'everyone') {
        if (message.senderId !== userId) {
            throw new Error("Unauthorized to delete this message for everyone");
        }

        // Verify delete window limit (24 hours)
        const timeDiff = Date.now() - new Date(message.createdAt).getTime();
        if (timeDiff > 24 * 60 * 60 * 1000) {
            throw new Error("Delete for everyone window has expired (24 hours)");
        }

        // If message has an attachment, delete it from R2 storage
        if (message.attachmentUrl) {
            try {
                await deleteFileFromR2(message.attachmentUrl);
            } catch (err) {
                console.error("Failed to delete attachment file from R2:", err);
            }
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                content: "This message was deleted",
                isDeleted: true,
                attachmentUrl: null,
                attachmentType: null,
                attachmentName: null,
                updatedAt: new Date()
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        profile: {
                            select: {
                                displayName: true,
                                username: true,
                                profilePhotoUrl: true,
                            }
                        }
                    }
                }
            }
        });

        const flattened = flattenMessageSender(updatedMessage);

        const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: message.conversationId }
        });
        
        const io = getIO();
        participants.forEach((p) => {
            io.to(p.userId).emit("message_updated", flattened);
        });

        return flattened;
    } else {
        // Delete for me
        const isParticipant = await checkUserInConversation(message.conversationId, userId);
        if (!isParticipant) {
            throw new Error("Unauthorized to access this conversation");
        }

        await prisma.userDeletedMessage.create({
            data: {
                userId,
                messageId
            }
        });

        // Emit to user's other sessions to keep UI synchronized across tabs
        const io = getIO();
        io.to(userId).emit("message_deleted_for_me", { messageId, conversationId: message.conversationId });

        return true;
    }
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
