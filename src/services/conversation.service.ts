import { prisma } from "../lib/prisma.js";
import { generatePresignedDownloadUrl } from "./storage.service.js";

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
                            email: true,
                            profile: {
                                select: {
                                    displayName: true,
                                    username: true,
                                    status: true,
                                    lastSeen: true,
                                    profilePhotoUrl: true,
                                }
                            },
                            settings: {
                                select: {
                                    readReceiptsEnabled: true,
                                }
                            }
                        },
                    },
                },
            },
            messages: {
                where: {
                    deletedForUsers: {
                        none: {
                            userId: userId
                        }
                    }
                },
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

    // Fetch active blocks for the user to determine block status per conversation
    const blocks = await prisma.block.findMany({
        where: {
            OR: [
                { blockerId: userId },
                { blockedId: userId }
            ]
        }
    });

    const blockedByUserIds = new Set(blocks.filter(b => b.blockerId === userId).map(b => b.blockedId));
    const blockingUserIds = new Set(blocks.filter(b => b.blockedId === userId).map(b => b.blockerId));

    const conversationsMapped = await Promise.all(conversations.map(async conv => {
        const otherParticipant = conv.participants.find(p => p.userId !== userId);
        const otherUserId = otherParticipant ? otherParticipant.userId : userId;
        const isBlockedByMe = blockedByUserIds.has(otherUserId);
        const isBlockedByThem = blockingUserIds.has(otherUserId);

        const myParticipant = conv.participants.find(p => p.userId === userId);
        const myReadReceiptsEnabled = myParticipant?.user?.settings?.readReceiptsEnabled ?? true;

        const flattenedParticipants = await Promise.all(conv.participants.map(async p => {
            const flattened = flattenParticipantUser(p);
            if (p.userId !== userId) {
                const otherReadReceiptsEnabled = p.user?.settings?.readReceiptsEnabled ?? true;
                if (!myReadReceiptsEnabled || !otherReadReceiptsEnabled) {
                    flattened.lastReadAt = null;
                }
            }
            if (p.userId !== userId && isBlockedByThem) {
                if (flattened.user) {
                    flattened.user.profilePhotoUrl = null;
                    flattened.user.avatarUrl = null;
                    flattened.user.status = "OFFLINE";
                    flattened.user.lastSeen = null;
                }
            } else if (flattened.user?.profilePhotoUrl) {
                try {
                    flattened.user.avatarUrl = await generatePresignedDownloadUrl(flattened.user.profilePhotoUrl);
                } catch (err) {
                    console.error("Error signing participant avatar", err);
                }
            }
            return flattened;
        }));

        return {
            ...conv,
            participants: flattenedParticipants,
            unreadCount: unreadCountsMap.get(conv.id) || 0,
            isBlockedByMe,
            isBlockedByThem
        };
    }));

    return conversationsMapped;
};

const flattenParticipantUser = (participant: any) => {
    if (!participant || !participant.user) return participant;
    const userProfile = participant.user.profile;
    return {
        ...participant,
        user: {
            id: participant.user.id,
            email: participant.user.email,
            displayName: userProfile?.displayName || "",
            username: userProfile?.username || "",
            status: userProfile?.status || "OFFLINE",
            lastSeen: userProfile?.lastSeen || null,
            profilePhotoUrl: userProfile?.profilePhotoUrl || null,
        }
    };
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
                        email: true,
                        profile: {
                            select: {
                                displayName: true,
                                username: true,
                                status: true,
                                lastSeen: true,
                                profilePhotoUrl: true,
                            }
                        },
                        settings: {
                            select: {
                                readReceiptsEnabled: true,
                            }
                        }
                    },
                },
            },
        },
        messages: {
            where: {
                deletedForUsers: {
                    none: {
                        userId: currentUserId,
                    },
                },
            },
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
        // Check if block exists
        const blocks = await prisma.block.findMany({
            where: {
                OR: [
                    { blockerId: currentUserId, blockedId: participantId },
                    { blockerId: participantId, blockedId: currentUserId }
                ]
            }
        });
        const isBlockedByMe = blocks.some(b => b.blockerId === currentUserId);
        const isBlockedByThem = blocks.some(b => b.blockerId === participantId);

        const myParticipant = exactMatch.participants.find(p => p.userId === currentUserId);
        const myReadReceiptsEnabled = myParticipant?.user?.settings?.readReceiptsEnabled ?? true;

        const flattenedParticipants = await Promise.all(exactMatch.participants.map(async p => {
            const flattened = flattenParticipantUser(p);
            if (p.userId !== currentUserId) {
                const otherReadReceiptsEnabled = p.user?.settings?.readReceiptsEnabled ?? true;
                if (!myReadReceiptsEnabled || !otherReadReceiptsEnabled) {
                    flattened.lastReadAt = null;
                }
            }
            if (p.userId !== currentUserId && isBlockedByThem) {
                if (flattened.user) {
                    flattened.user.profilePhotoUrl = null;
                    flattened.user.avatarUrl = null;
                    flattened.user.status = "OFFLINE";
                    flattened.user.lastSeen = null;
                }
            } else if (flattened.user?.profilePhotoUrl) {
                try {
                    flattened.user.avatarUrl = await generatePresignedDownloadUrl(flattened.user.profilePhotoUrl);
                } catch (err) {
                    console.error("Error signing participant avatar", err);
                }
            }
            return flattened;
        }));

        return { 
            conversation: {
                ...exactMatch,
                participants: flattenedParticipants,
                isBlockedByMe,
                isBlockedByThem
            }, 
            isNew: false 
        };
    }

    // No existing conversation. Check if either user has blocked the other.
    if (!isSelfConversation) {
        const blockExists = await prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: currentUserId, blockedId: participantId },
                    { blockerId: participantId, blockedId: currentUserId }
                ]
            }
        });
        if (blockExists) {
            throw new Error("You cannot start a conversation with this user.");
        }
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

    const myParticipant = newConversation.participants.find(p => p.userId === currentUserId);
    const myReadReceiptsEnabled = myParticipant?.user?.settings?.readReceiptsEnabled ?? true;

    const flattenedParticipants = await Promise.all(newConversation.participants.map(async p => {
        const flattened = flattenParticipantUser(p);
        if (p.userId !== currentUserId) {
            const otherReadReceiptsEnabled = p.user?.settings?.readReceiptsEnabled ?? true;
            if (!myReadReceiptsEnabled || !otherReadReceiptsEnabled) {
                flattened.lastReadAt = null;
            }
        }
        if (flattened.user?.profilePhotoUrl) {
            try {
                flattened.user.avatarUrl = await generatePresignedDownloadUrl(flattened.user.profilePhotoUrl);
            } catch (err) {
                console.error("Error signing participant avatar", err);
            }
        }
        return flattened;
    }));

    return { 
        conversation: {
            ...newConversation,
            participants: flattenedParticipants,
            isBlockedByMe: false,
            isBlockedByThem: false
        }, 
        isNew: true 
    };
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
        include: {
            user: {
                select: {
                    settings: {
                        select: {
                            readReceiptsEnabled: true
                        }
                    }
                }
            }
        }
    });

    const readerParticipant = participants.find((p) => p.userId === userId);
    const readerReadReceiptsEnabled = readerParticipant?.user?.settings?.readReceiptsEnabled ?? true;

    const notifiedParticipantIds = readerReadReceiptsEnabled
        ? participants
            .filter((p) => p.userId !== userId && (p.user?.settings?.readReceiptsEnabled ?? true))
            .map((p) => p.userId)
        : [];

    return {
        notifiedParticipantIds,
        readAt: readAt.toISOString(),
    };
};

export const muteConversationService = async (conversationId: string, userId: string, duration: string) => {
    let mutedUntil: Date | null = null;
    const now = Date.now();

    switch (duration) {
        case "1h":
            mutedUntil = new Date(now + 60 * 60 * 1000);
            break;
        case "8h":
            mutedUntil = new Date(now + 8 * 60 * 60 * 1000);
            break;
        case "24h":
            mutedUntil = new Date(now + 24 * 60 * 60 * 1000);
            break;
        case "7d":
            mutedUntil = new Date(now + 7 * 24 * 60 * 60 * 1000);
            break;
        case "always":
            mutedUntil = new Date("9999-12-31T23:59:59.999Z");
            break;
        case "none":
        default:
            mutedUntil = null;
            break;
    }

    const participant = await prisma.conversationParticipant.update({
        where: {
            conversationId_userId: {
                conversationId,
                userId,
            },
        },
        data: {
            mutedUntil,
        },
    });

    return participant;
};

export const getConversationAttachmentsService = async (
    conversationId: string,
    userId: string,
    type: 'media' | 'document',
    cursor?: string,
    limit: number = 20
) => {
    // Verify user is in conversation
    const participant = await prisma.conversationParticipant.findUnique({
        where: {
            conversationId_userId: {
                conversationId,
                userId
            }
        }
    });

    if (!participant) {
        throw new Error("Unauthorized to access this conversation");
    }

    const take = limit + 1;

    // Build filter based on type
    const attachmentFilter: any = {
        conversationId,
        attachmentUrl: { not: null }
    };

    if (type === 'media') {
        attachmentFilter.OR = [
            { attachmentType: { startsWith: 'image/' } },
            { attachmentType: { startsWith: 'video/' } },
            { attachmentType: { startsWith: 'audio/' } }
        ];
    } else {
        attachmentFilter.NOT = [
            { attachmentType: { startsWith: 'image/' } },
            { attachmentType: { startsWith: 'video/' } },
            { attachmentType: { startsWith: 'audio/' } }
        ];
    }

    const messages = await prisma.message.findMany({
        where: attachmentFilter,
        include: {
            sender: {
                select: {
                    id: true,
                    profile: {
                        select: {
                            displayName: true
                        }
                    }
                }
            }
        },
        take,
        ...(cursor && {
            skip: 1,
            cursor: { id: cursor }
        }),
        orderBy: {
            createdAt: 'desc'
        }
    });

    const hasMore = messages.length > limit;
    const paginatedMessages = hasMore ? messages.slice(0, limit) : messages;

    const attachments = await Promise.all(paginatedMessages.map(async (msg) => {
        let signedUrl = "";
        if (msg.attachmentUrl) {
            try {
                signedUrl = await generatePresignedDownloadUrl(msg.attachmentUrl);
            } catch (err) {
                console.error(`Failed to sign attachment URL for message ${msg.id}`, err);
            }
        }
        return {
            messageId: msg.id,
            attachmentUrl: signedUrl,
            attachmentType: msg.attachmentType,
            attachmentName: msg.attachmentName,
            createdAt: msg.createdAt.toISOString(),
            sender: msg.sender ? {
                id: msg.sender.id,
                displayName: msg.sender.profile?.displayName || "User"
            } : null
        };
    }));

    const nextCursor = hasMore ? paginatedMessages[paginatedMessages.length - 1]?.id : null;

    return {
        attachments,
        nextCursor,
        hasMore
    };
};