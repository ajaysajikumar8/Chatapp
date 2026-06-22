// This file is the entry point of the server application. 
// It imports the Express app from app.ts and starts the server on a specified port.

import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';
import { startHeartbeat, shutdownInstance } from './services/presence.service.js';
import { isRedisEnabled, redis, pubClient, subClient } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
initSocket(server);

// Start the registry heartbeat for this server instance
startHeartbeat();

const runningServer = server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  runningServer.close(async () => {
    console.log("HTTP server closed.");

    try {
      // Clean up instance mappings and stop heartbeat
      await shutdownInstance();

      // Disconnect Prisma
      await prisma.$disconnect();
      console.log("Prisma client disconnected.");

      // Disconnect Redis client instances if enabled
      if (isRedisEnabled) {
        if (redis) await redis.quit();
        if (pubClient) await pubClient.quit();
        if (subClient) await subClient.quit();
        console.log("Redis connections closed.");
      }

      console.log("Graceful shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  });

  // Force shutdown after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error("Force exiting: Graceful shutdown timed out.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));