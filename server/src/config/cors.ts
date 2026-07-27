import type { CorsOptions } from "cors";
import type { IncomingMessage } from "node:http";
import type { ServerEnv } from "./env.js";

export class CorsOriginError extends Error {
  readonly code = "CORS_ORIGIN_DENIED";
  readonly status = 403;

  constructor() {
    super("Bu origin için erişim izni bulunmuyor.");
    this.name = "CorsOriginError";
  }
}

const normalizeOrigin = (origin: string) => new URL(origin.trim()).origin;

export function getAllowedOrigins(appEnv: ServerEnv): ReadonlySet<string> {
  const configured = appEnv.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  configured.push(normalizeOrigin(appEnv.CLIENT_URL));

  if (appEnv.NODE_ENV !== "production") {
    configured.push(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173"
    );
  }

  return new Set(configured);
}

export function createCorsOriginValidator(appEnv: ServerEnv) {
  const allowedOrigins = getAllowedOrigins(appEnv);
  return (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new CorsOriginError());
  };
}

export function createSocketRequestValidator(appEnv: ServerEnv) {
  const allowedOrigins = getAllowedOrigins(appEnv);
  return (
    request: IncomingMessage,
    callback: (error: string | null | undefined, allowed: boolean) => void
  ) => {
    const origin = request.headers.origin;
    if (!origin) {
      callback(null, appEnv.NODE_ENV !== "production");
      return;
    }

    try {
      callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    } catch {
      callback(null, false);
    }
  };
}

export function createCorsOptions(appEnv: ServerEnv): CorsOptions {
  return {
    origin: createCorsOriginValidator(appEnv),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400
  };
}
