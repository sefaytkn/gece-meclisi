import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { createCorsOriginValidator, createSocketRequestValidator } from "./config/cors.js";
import { env } from "./config/env.js";
import { prisma } from "./prisma/client.js";
import { setupSocket } from "./socket/setupSocket.js";
import { logger } from "./utils/logger.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: createCorsOriginValidator(env),
    credentials: true,
    methods: ["GET", "POST"]
  },
  allowRequest: createSocketRequestValidator(env),
  maxHttpBufferSize: 32_000,
  pingTimeout: 20_000,
  pingInterval: 25_000
});

const socketRuntime = setupSocket(io);

httpServer.listen(env.PORT, "0.0.0.0", () => {
  logger.info("Gece Meclisi server started", {
    host: "0.0.0.0",
    port: env.PORT,
    environment: env.NODE_ENV
  });
});

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  logger.info("Graceful shutdown started", { reason, exitCode });
  socketRuntime.close();

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  const shutdownResults = await Promise.allSettled([
    new Promise<void>((resolve) => io.close(() => resolve())),
    prisma.$disconnect()
  ]);

  if (httpServer.listening) {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    }).catch((error) => logger.error("HTTP server shutdown failed", error));
  }

  shutdownResults.forEach((result) => {
    if (result.status === "rejected") logger.error("Shutdown operation failed", result.reason);
  });

  clearTimeout(forceExit);
  logger.info("Graceful shutdown completed", { reason });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
  void shutdown("unhandledRejection", 1);
});
process.once("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
  void shutdown("uncaughtException", 1);
});
