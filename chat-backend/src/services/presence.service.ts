import { redis, isRedisEnabled } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

// Unique identifier for this server instance
export const serverId = crypto.randomUUID();

const SOCKETS_SET_PREFIX = "user:sockets:";
const STATUSES_HASH_KEY = "user:presence:statuses";
const SERVER_SOCKETS_PREFIX = "server:sockets:";
const ACTIVE_SERVERS_PREFIX = "active_servers:";

// Heartbeat and cleanup interval references
let heartbeatInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

// In-memory sockets map for single-instance / fallback mode
const inMemoryUserSockets = new Map<string, Set<string>>();

/**
 * Marks a user socket connection as online.
 * Returns true if the user's overall status transitioned from offline to online.
 */
export const setUserOnline = async (userId: string, socketId: string): Promise<boolean> => {
    if (!isRedisEnabled || !redis) {
        let userSockets = inMemoryUserSockets.get(userId);
        if (!userSockets) {
            userSockets = new Set();
            inMemoryUserSockets.set(userId, userSockets);
        }
        const initialSize = userSockets.size;
        userSockets.add(socketId);

        // Transition user status to ONLINE on first connection
        if (initialSize === 0) {
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
    }

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
    if (!isRedisEnabled || !redis) {
        const userSockets = inMemoryUserSockets.get(userId);
        if (userSockets) {
            userSockets.delete(socketId);
            if (userSockets.size === 0) {
                inMemoryUserSockets.delete(userId);
                const lastSeen = new Date();
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
        }
        return false;
    }

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
    if (!isRedisEnabled || !redis) {
        return inMemoryUserSockets.has(userId) ? "ONLINE" : "OFFLINE";
    }
    const status = await redis.hget(STATUSES_HASH_KEY, userId);
    return status === "ONLINE" ? "ONLINE" : "OFFLINE";
};

/**
 * Gets the online status of multiple users in a single pipelined batch.
 */
export const getUserStatuses = async (userIds: string[]): Promise<Record<string, "ONLINE" | "OFFLINE">> => {
    if (userIds.length === 0) return {};

    if (!isRedisEnabled || !redis) {
        const result: Record<string, "ONLINE" | "OFFLINE"> = {};
        userIds.forEach((id) => {
            result[id] = inMemoryUserSockets.has(id) ? "ONLINE" : "OFFLINE";
        });
        return result;
    }

    const statuses = await redis.hmget(STATUSES_HASH_KEY, ...userIds);
    const result: Record<string, "ONLINE" | "OFFLINE"> = {};

    userIds.forEach((id, idx) => {
        result[id] = statuses[idx] === "ONLINE" ? "ONLINE" : "OFFLINE";
    });

    return result;
};

/**
 * Registers this server instance with a periodic heartbeat in Redis.
 */
export const startHeartbeat = () => {
    if (!isRedisEnabled || !redis) return;

    // Register active server instance in Redis immediately (expires in 30 seconds)
    redis.set(`${ACTIVE_SERVERS_PREFIX}${serverId}`, "1", "EX", 30)
        .catch((err) => console.error(`Failed to set server heartbeat for instance ${serverId}:`, err));

    // Refresh registration key every 10 seconds
    heartbeatInterval = setInterval(() => {
        if (redis) {
            redis.set(`${ACTIVE_SERVERS_PREFIX}${serverId}`, "1", "EX", 30)
                .catch((err) => console.error(`Failed to refresh server heartbeat for instance ${serverId}:`, err));
        }
    }, 10000);
    console.log(`Presence service heartbeat started for instance: ${serverId}`);

    // Run a periodic cleanup check every 60 seconds to purge any crashed/stopped server instances
    cleanupInterval = setInterval(() => {
        cleanOrphanedSockets().catch((err) => console.error("Periodic socket cleanup failed:", err));
    }, 60000);
};

/**
 * Stops the heartbeat timer.
 */
export const stopHeartbeat = async () => {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    if (isRedisEnabled && redis) {
        try {
            await redis.del(`${ACTIVE_SERVERS_PREFIX}${serverId}`);
        } catch (err) {
            console.error(`Failed to remove server heartbeat registration:`, err);
        }
    }
};

/**
 * Cleans up socket connections associated with dead server instances.
 * Run on server startup to handle previous crashes/forced restarts.
 */
export const cleanOrphanedSockets = async (): Promise<void> => {
    if (!isRedisEnabled || !redis) {
        // Single-instance: Reset all database user statuses to OFFLINE since 
        // the server process is starting fresh with 0 active connections.
        try {
            const lastSeen = new Date();
            await prisma.userProfile.updateMany({
                where: { status: "ONLINE" },
                data: { status: "OFFLINE", lastSeen }
            });
            console.log("Startup presence reset: All users set to OFFLINE in database.");
        } catch (err) {
            console.error("Startup presence reset failed:", err);
        }
        return;
    }

    console.log(`Scanning for orphaned socket sets...`);

    return new Promise<void>((resolve, reject) => {
        // Scan for all server socket sets
        const stream = redis!.scanStream({
            match: `${SERVER_SOCKETS_PREFIX}*`,
            count: 100
        });

        const promises: Promise<void>[] = [];

        stream.on("data", (keys: string[]) => {
            for (const serverSocketsKey of keys) {
                const targetServerId = serverSocketsKey.replace(SERVER_SOCKETS_PREFIX, "");

                // Skip cleaning our own active socket set
                if (targetServerId === serverId) continue;

                promises.push((async () => {
                    // Check if this server instance is still active
                    const isActive = await redis!.exists(`${ACTIVE_SERVERS_PREFIX}${targetServerId}`);
                    if (isActive === 1) {
                        return; // Active instance, do not touch
                    }

                    // Instance has crashed/died, let's clean up its orphaned sockets
                    const activeSockets = await redis!.smembers(serverSocketsKey);
                    if (activeSockets.length === 0) {
                        await redis!.del(serverSocketsKey);
                        return;
                    }

                    console.log(`Cleaning up ${activeSockets.length} orphaned sockets from dead server instance ${targetServerId}...`);

                    for (const item of activeSockets) {
                        const [userId, socketId] = item.split(":");
                        if (!userId || !socketId) continue;

                        const userSocketsKey = `${SOCKETS_SET_PREFIX}${userId}`;
                        const memberValue = `${targetServerId}:${socketId}`;

                        // Remove dead server socket from user's socket list
                        await redis!.srem(userSocketsKey, memberValue);

                        // Check if user is now offline globally
                        const count = await redis!.scard(userSocketsKey);
                        if (count === 0) {
                            const lastSeen = new Date();
                            await redis!.hset(STATUSES_HASH_KEY, userId, "OFFLINE");
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

                    // Delete the server socket key
                    await redis!.del(serverSocketsKey);
                    console.log(`Presence cleanup completed for dead server ${targetServerId}.`);
                })());
            }
        });

        stream.on("end", async () => {
            try {
                await Promise.all(promises);
                resolve();
            } catch (err) {
                reject(err);
            }
        });

        stream.on("error", (err) => {
            reject(err);
        });
    });
};

/**
 * Handles graceful cleanup of the current server instance's socket mappings on shutdown.
 */
export const shutdownInstance = async (): Promise<void> => {
    console.log(`Shutting down presence service for server instance: ${serverId}`);
    await stopHeartbeat();

    if (!isRedisEnabled || !redis) {
        // Single-instance: Reset database user statuses to OFFLINE
        try {
            const lastSeen = new Date();
            await prisma.userProfile.updateMany({
                where: { status: "ONLINE" },
                data: { status: "OFFLINE", lastSeen }
            });
            console.log("Database user statuses reset to OFFLINE on shutdown.");
        } catch (err) {
            console.error("Failed to reset database user statuses on shutdown:", err);
        }
        return;
    }

    const serverSocketsKey = `${SERVER_SOCKETS_PREFIX}${serverId}`;
    const activeSockets = await redis.smembers(serverSocketsKey);

    if (activeSockets.length > 0) {
        console.log(`Cleaning up ${activeSockets.length} active sockets from this instance...`);
        for (const item of activeSockets) {
            const [userId, socketId] = item.split(":");
            if (!userId || !socketId) continue;

            const userSocketsKey = `${SOCKETS_SET_PREFIX}${userId}`;
            const memberValue = `${serverId}:${socketId}`;

            await redis.srem(userSocketsKey, memberValue);
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
                    console.error(`Failed to update DB presence for user ${userId} to OFFLINE on shutdown:`, err);
                }
            }
        }
    }

    await redis.del(serverSocketsKey);
    console.log(`Presence service shutdown completed for server instance: ${serverId}`);
};
