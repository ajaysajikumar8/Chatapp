import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifyToken } from "../utils/jwt.js";

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

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.data.user.id})`);

        // Force user to join a room named after their userId
        socket.join(socket.data.user.id);
        
        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });

        // Add additional event listeners here if necessary
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
