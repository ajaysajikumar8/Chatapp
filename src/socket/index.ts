import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

let io: SocketIOServer;

export const initSocket = (server: HTTPServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: "*", // Adjust this in production to your frontend URL
            methods: ["GET", "POST"]
        }
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = verifyToken(token);
            socket.data.user = decoded; // Store user payload in socket.data
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
        
        // Update presence to ONLINE
        try {
            await prisma.userProfile.update({
                where: { userId },
                data: { status: "ONLINE" }
            });
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
        } catch (error) {
            console.error("Error updating user presence to ONLINE:", error);
        }

        socket.on("disconnect", async () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Check if user has other active connections
            const matchingSockets = await io.in(userId).fetchSockets();
            const isDisconnected = matchingSockets.length === 0;

            if (isDisconnected) {
                try {
                    const lastSeen = new Date();
                    await prisma.userProfile.update({
                        where: { userId },
                        data: { status: "OFFLINE", lastSeen }
                    });
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
                } catch (error) {
                    console.error("Error updating user presence to OFFLINE:", error);
                }
            }
        });

        // Typing indicators
        socket.on("typing_start", async ({ conversationId, recipientId }) => {
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
