import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";
import { pubClient, subClient, isRedisEnabled } from "../lib/redis.js";
import { setUserOnline, setUserOffline, cleanOrphanedSockets } from "../services/presence.service.js";
import { isProductionSafeguardsEnabled } from "../middleware/rateLimit.middleware.js";

let io: SocketIOServer;

export const initSocket = (server: HTTPServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: "*", // Adjust this in production to your frontend URL
            methods: ["GET", "POST"]
        }
    });

    // Attach Redis Adapter for multi-instance socket scaling
    if (isRedisEnabled && pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("Attached Redis Adapter for multi-instance Socket.IO scaling.");
    } else {
        console.log("Redis is disabled or unavailable. Using default in-memory Socket.IO adapter.");
    }

    // Run cleanup for any stale socket connections recorded for this server instance
    cleanOrphanedSockets().catch((err) => console.error("Error cleaning orphaned sockets:", err));

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = verifyToken(token);
            socket.data.user = decoded; // Store user payload in socket.data
            
            if (isProductionSafeguardsEnabled) {
                const maxConcurrent = process.env.MAX_CONCURRENT_USERS ? parseInt(process.env.MAX_CONCURRENT_USERS, 10) : 20;
                if (io.engine.clientsCount >= maxConcurrent) {
                    return next(new Error("Connection limit reached. This demo is currently full. Please try again later."));
                }
            }

            next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.data.user.id;
        console.log(`Socket connected: ${socket.id} (User: ${userId})`);

        // Force user to join a room named after their userId
        socket.join(userId);
        
        // Update presence to ONLINE in Redis
        try {
            const statusChanged = await setUserOnline(userId, socket.id);
            if (statusChanged) {
                const blocks = await prisma.block.findMany({
                    where: {
                        OR: [
                            { blockerId: userId },
                            { blockedId: userId }
                        ]
                    },
                    select: {
                        blockerId: true,
                        blockedId: true
                    }
                });
                const excludedRooms = blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
                io.except(excludedRooms).emit("user_presence_changed", { userId, status: "ONLINE" });
            }
        } catch (error) {
            console.error("Error updating user presence to ONLINE:", error);
        }

        socket.on("disconnect", async () => {
            console.log(`Socket disconnected: ${socket.id}`);
            
            try {
                const statusChanged = await setUserOffline(userId, socket.id);
                if (statusChanged) {
                    const lastSeen = new Date();
                    const blocks = await prisma.block.findMany({
                        where: {
                            OR: [
                                { blockerId: userId },
                                { blockedId: userId }
                            ]
                        },
                        select: {
                            blockerId: true,
                            blockedId: true
                        }
                    });
                    const excludedRooms = blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
                    io.except(excludedRooms).emit("user_presence_changed", { userId, status: "OFFLINE", lastSeen });
                }
            } catch (error) {
                console.error("Error updating user presence to OFFLINE:", error);
            }
        });

        // Typing indicators
        socket.on("typing_start", async ({ conversationId, recipientId }) => {
            const now = Date.now();
            const lastTyping = socket.data.lastTypingStart || 0;
            const typingLimit = process.env.TYPING_LIMIT_MS ? parseInt(process.env.TYPING_LIMIT_MS, 10) : 1000;
            
            if (isProductionSafeguardsEnabled && now - lastTyping < typingLimit) {
                return;
            }
            socket.data.lastTypingStart = now;

            try {
                const blockExists = await prisma.block.findFirst({
                    where: {
                        OR: [
                            { blockerId: userId, blockedId: recipientId },
                            { blockerId: recipientId, blockedId: userId }
                        ]
                    }
                });
                if (!blockExists) {
                    socket.to(recipientId).emit("typing_start", { conversationId, userId });
                }
            } catch (error) {
                console.error("Error checking block for typing_start:", error);
            }
        });

        socket.on("typing_stop", async ({ conversationId, recipientId }) => {
            const now = Date.now();
            const lastTyping = socket.data.lastTypingStop || 0;
            const typingLimit = process.env.TYPING_LIMIT_MS ? parseInt(process.env.TYPING_LIMIT_MS, 10) : 1000;
            
            if (isProductionSafeguardsEnabled && now - lastTyping < typingLimit) {
                return;
            }
            socket.data.lastTypingStop = now;

            try {
                const blockExists = await prisma.block.findFirst({
                    where: {
                        OR: [
                            { blockerId: userId, blockedId: recipientId },
                            { blockerId: recipientId, blockedId: userId }
                        ]
                    }
                });
                if (!blockExists) {
                    socket.to(recipientId).emit("typing_stop", { conversationId, userId });
                }
            } catch (error) {
                console.error("Error checking block for typing_stop:", error);
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
