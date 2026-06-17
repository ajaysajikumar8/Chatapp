import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Main client for general caching (presence data)
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

// Pub/Sub clients for Socket.io adapter scaling
const pubClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});
const subClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

// Error handling to prevent server crashes on Redis connection issues
redis.on("error", (err) => console.error("Redis client error:", err));
pubClient.on("error", (err) => console.error("Redis pubClient error:", err));
subClient.on("error", (err) => console.error("Redis subClient error:", err));

export { redis, pubClient, subClient };
