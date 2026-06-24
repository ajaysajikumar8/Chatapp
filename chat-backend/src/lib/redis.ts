import "./env.js";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const isRedisEnabled = process.env.USE_REDIS !== "false";

let redis: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

if (isRedisEnabled) {
    // Main client for general caching (presence data)
    redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
    });

    // Pub/Sub clients for Socket.io adapter scaling
    pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
    });
    subClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
    });

    // Error handling to prevent server crashes on Redis connection issues
    redis.on("error", (err) => console.error("Redis client error:", err));
    pubClient.on("error", (err) => console.error("Redis pubClient error:", err));
    subClient.on("error", (err) => console.error("Redis subClient error:", err));
} else {
    console.log("Redis is disabled via USE_REDIS env variable. Running in single-instance fallback mode.");
}

export { redis, pubClient, subClient, isRedisEnabled };
