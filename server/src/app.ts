import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { env, type ServerEnv } from "./config/env.js";
import { createCorsOptions, CorsOriginError } from "./config/cors.js";
import { optionalAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.routes.js";
import gameRoutes from "./routes/game.routes.js";
import { AppError } from "./utils/AppError.js";
import { prisma } from "./prisma/client.js";
import { logger } from "./utils/logger.js";

interface CreateAppOptions {
  appEnv?: ServerEnv;
  healthCheck?: () => Promise<unknown>;
  apiRateLimitMax?: number;
}

const defaultHealthCheck = () => prisma.$queryRaw`SELECT 1`;

export function createApp({
  appEnv = env,
  healthCheck = defaultHealthCheck,
  apiRateLimitMax = 120
}: CreateAppOptions = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.info("HTTP request", {
        method: req.method,
        path: req.path,
        requestId: req.id,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        ip: req.ip
      });
    });
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors(createCorsOptions(appEnv)));
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use(cookieParser());
  app.use(optionalAuth);

  const healthHandler: express.RequestHandler = async (_req, res) => {
    try {
      await healthCheck();
      res.status(200).json({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error("Health check database query failed", error);
      res.status(503).json({
        success: false,
        status: "unhealthy",
        timestamp: new Date().toISOString()
      });
    }
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
  app.get("/ready", async (_req, res) => {
    try {
      await healthCheck();
      res.status(200).json({
        success: true,
        status: "ready",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error("Readiness database query failed", error);
      res.status(503).json({
        success: false,
        status: "not_ready",
        timestamp: new Date().toISOString()
      });
    }
  });

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: apiRateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: "RATE_LIMITED", message: "Çok fazla istek gönderildi." }
      }
    })
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/games", gameRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Kaynak bulunamadı." }
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error instanceof CorsOriginError) {
      res.status(error.status).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Geçersiz veri."
        }
      });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
      return;
    }

    logger.error("Unhandled HTTP error", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Beklenmeyen bir sunucu hatası oluştu."
      },
      requestId: _req.id
    });
  };

  app.use(errorHandler);
  return app;
}

export const app = createApp();
