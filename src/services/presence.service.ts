import { redis } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

// Unique identifier for this server instance
export const serverId = crypto.randomUUID();

const SOCKETS_SET_PREFIX = "user:sockets:";
const STATUSES_HASH_KEY = "user:presence:statuses";
const SERVER_SOCKETS_PREFIX = "server:sockets:";

/**
 * Marks a user socket connection as online.
 * Returns true if the user's overall status transitioned from offline to online.
 */
export const setUserOnline = async (userId: string, socketId: string): Promise<boolean> => {
    const userSocketsKey = `${SOCKETS_SET_PREFIX}${userId}`;
    const serverSocketsKey = `${SERVER_SOCKETS_PREFIX}${serverId}`;
    const memberValue = `${serverId}:${socketId}`;

    // Add socket to user's set and server's active set
    const [, added] = await redis
        .multi()
        .sadd(userSocketsKey, memberValue)
        .sadd(serverSocketsKey, `${userId}:${socketId}`)
        .exec() as [any, [number, number]];

    // Get current cardinality of user sockets
    const count = await redis.scard(userSocketsKey);

    // If it's the first connection, status transitions to ONLINE
    if (count === 1) {
        await redis.hset(STATUSES_HASH_KEY, userId, "ONLINE");
        // Update database profile status to ONLINE (keeps it synced, but we read from Redis first)
        try {
            await prisma.userProfile.update({
                where: { userId },
                data: { status: "ONLINE" }
            });
        } catch (err) {
            console.error(`Failed to update DB presence for user ${userId} to ONLINE:`, err);
        }
        return true;
    }

    return false;
};

/**
 * Marks a user socket connection as offline.
 * Returns true if the user's overall status transitioned from online to offline (all tabs closed).
 */
export const setUserOffline = async (userId: string, socketId: string): Promise<boolean> => {
    const userSocketsKey = `${SOCKETS_SET_PREFIX}${userId}`;
    const serverSocketsKey = `${SERVER_SOCKETS_PREFIX}${serverId}`;
    const memberValue = `${serverId}:${socketId}`;

    // Remove socket from user's set and server's active set
    await redis
        .multi()
        .srem(userSocketsKey, memberValue)
        .srem(serverSocketsKey, `${userId}:${socketId}`)
        .exec();

    // Check if user has any other active connections
    const count = await redis.scard(userSocketsKey);

    if (count === 0) {
        const lastSeen = new Date();
        // Transition user status to OFFLINE
        await redis.hset(STATUSES_HASH_KEY, userId, "OFFLINE");

        // Persist OFFLINE status and lastSeen timestamp to PostgreSQL
        try {
            await prisma.userProfile.update({
                where: { userId },
                data: { status: "OFFLINE", lastSeen }
            });
        } catch (err) {
            console.error(`Failed to update DB presence for user ${userId} to OFFLINE:`, err);
        }
        return true;
    }

    return false;
};

/**
 * Gets the online status of a user (checks Redis, falls back to OFFLINE).
 */
export const getUserStatus = async (userId: string): Promise<"ONLINE" | "OFFLINE"> => {
    const status = await redis.hget(STATUSES_HASH_KEY, userId);
    return status === "ONLINE" ? "ONLINE" : "OFFLINE";
};

/**
 * Gets the online status of multiple users in a single pipelined batch.
 */
export const getUserStatuses = async (userIds: string[]): Promise<Record<string, "ONLINE" | "OFFLINE">> => {
    if (userIds.length === 0) return {};

    const statuses = await redis.hmget(STATUSES_HASH_KEY, ...userIds);
    const result: Record<string, "ONLINE" | "OFFLINE"> = {};

    userIds.forEach((id, idx) => {
        result[id] = statuses[idx] === "ONLINE" ? "ONLINE" : "OFFLINE";
    });

    return result;
};

/**
 * Cleans up socket connections associated with this server instance.
 * Run on server startup to handle previous crashes/forced restarts.
 */
export const cleanOrphanedSockets = async (): Promise<void> => {
    const serverSocketsKey = `${SERVER_SOCKETS_PREFIX}${serverId}`;
    
    // Fetch all active sockets recorded for this server instance
    const activeSockets = await redis.smembers(serverSocketsKey);
    if (activeSockets.length === 0) return;

    console.log(`Cleaning up ${activeSockets.length} orphaned sockets from server instance ${serverId}...`);

    for (const item of activeSockets) {
        const [userId, socketId] = item.split(":");
        if (!userId || !socketId) continue;

        const userSocketsKey = `${SOCKETS_SET_PREFIX}${userId}`;
        const memberValue = `${serverId}:${socketId}`;

        // Remove from user sockets set
        await redis.srem(userSocketsKey, memberValue);

        // Check if user is now offline
        const count = await redis.scard(userSocketsKey);
        if (count === 0) {
            const lastSeen = new Date();
            await redis.hset(STATUSES_HASH_KEY, userId, "OFFLINE");
            try {
                await prisma.userProfile.update({
                    where: { userId },
                    data: { status: "OFFLINE", lastSeen }
                });
            } catch (err) {
                console.error(`Failed to cleanup presence update for user ${userId} to OFFLINE:`, err);
            }
        }
    }

    // Delete the server's set key
    await redis.del(serverSocketsKey);
    console.log(`Presence cleanup completed for server ${serverId}.`);
};
