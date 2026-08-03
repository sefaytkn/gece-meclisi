import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { parseServerEnv } from "./config/env.js";
import { getSessionCookieOptions } from "./config/cookie.js";
import { redactSensitive } from "./utils/logger.js";
import { assertPhaseOpen, enforceSlidingWindow, haveAllAlivePlayersVoted, parseChatInput, sanitizeChatMessage } from "./socket/setupSocket.js";
import { createSocketRequestValidator } from "./config/cors.js";
import { fail } from "./utils/ack.js";

const productionEnv = parseServerEnv({
  NODE_ENV: "production",
  PORT: "4000",
  DATABASE_URL: "postgresql://user:password@pool.example.neon.tech/db?sslmode=require",
  DIRECT_URL: "postgresql://user:password@direct.example.neon.tech/db?sslmode=require",
  JWT_SECRET: "a-production-secret-with-more-than-32-characters",
  CLIENT_URL: "https://gece-meclisi.vercel.app",
  CORS_ORIGIN: "https://gece-meclisi.vercel.app,https://oyun.example.com",
  COOKIE_SECURE: "true",
  COOKIE_SAME_SITE: "none"
});

describe("production HTTP yapılandırması", () => {
  it("health endpoint veritabanı erişilebildiğinde 200 döner", async () => {
    const app = createApp({ appEnv: productionEnv, healthCheck: async () => [{ "?column?": 1 }] });
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "healthy" });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it("health endpoint veritabanı erişilemediğinde ayrıntı sızdırmadan 503 döner", async () => {
    const app = createApp({
      appEnv: productionEnv,
      healthCheck: async () => {
        throw new Error("postgresql://admin:secret@private-host/database");
      }
    });
    const response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, status: "unhealthy" });
    expect(JSON.stringify(response.body)).not.toContain("private-host");
  });

  it("readiness endpoint reports database status and a server-generated request ID", async () => {
    const app = createApp({ appEnv: productionEnv, healthCheck: async () => true });
    const response = await request(app).get("/ready").set("X-Request-Id", "client-supplied");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, status: "ready" });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).not.toBe("client-supplied");
  });

  it("readiness endpoint returns 503 when the database is unavailable", async () => {
    const app = createApp({
      appEnv: productionEnv,
      healthCheck: async () => {
        throw new Error("database unavailable");
      }
    });
    const response = await request(app).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, status: "not_ready" });
  });

  it("izinli production origin için credentials CORS başlıklarını döner", async () => {
    const app = createApp({ appEnv: productionEnv, healthCheck: async () => true });
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://gece-meclisi.vercel.app");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://gece-meclisi.vercel.app");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("izinsiz production origin için kontrollü 403 döner", async () => {
    const app = createApp({ appEnv: productionEnv, healthCheck: async () => true });
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_DENIED");
  });

  it("Socket.IO upgrade isteğinde yalnızca allowlist origin'ine izin verir", () => {
    const validate = createSocketRequestValidator(productionEnv);
    let allowedOrigin = false;
    let deniedOrigin = true;
    let missingOrigin = true;

    validate({ headers: { origin: "https://gece-meclisi.vercel.app" } } as never, (_error, allowed) => {
      allowedOrigin = allowed;
    });
    validate({ headers: { origin: "https://evil.example" } } as never, (_error, allowed) => {
      deniedOrigin = allowed;
    });
    validate({ headers: {} } as never, (_error, allowed) => {
      missingOrigin = allowed;
    });

    expect(allowedOrigin).toBe(true);
    expect(deniedOrigin).toBe(false);
    expect(missingOrigin).toBe(false);
  });

  it("production cookie ayarlarını cross-site güvenli kurar", () => {
    expect(getSessionCookieOptions(productionEnv)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 604_800_000
    });
  });

  it("API rate limit aşıldığında 429 döner", async () => {
    const app = createApp({
      appEnv: productionEnv,
      healthCheck: async () => true,
      apiRateLimitMax: 2
    });
    await request(app).get("/api/unknown");
    await request(app).get("/api/unknown");
    const response = await request(app).get("/api/unknown");
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("production secret güvenliği", () => {
  it("zorunlu production env eksikse başlangıcı durdurur", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(/zorunlu environment variable eksik/i);
  });

  it("production frontend origin'lerinde HTTPS zorunluluğunu uygular", () => {
    expect(() =>
      parseServerEnv({
        ...productionEnv,
        NODE_ENV: "production",
        PORT: String(productionEnv.PORT),
        CLIENT_URL: "http://insecure.example",
        COOKIE_SECURE: "true"
      } as never)
    ).toThrow(/HTTPS/);
  });

  it("log metadata içindeki secret değerlerini maskeler", () => {
    const redacted = redactSensitive({
      authorization: "Bearer secret",
      password: "hunter2",
      reconnectToken: "opaque",
      nested: { databaseUrl: "postgresql://user:pass@host/db" },
      message: "Bearer abc.def.ghi"
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("opaque");
    expect(serialized).not.toContain("user:pass");
    expect(serialized).not.toContain("abc.def.ghi");
  });

  it("Socket event rate limit sınırını uygular", () => {
    const windows = new Map<string, number[]>();
    enforceSlidingWindow("socket-1", windows, 2, 10_000, "SOCKET_RATE_LIMIT", 1_000);
    enforceSlidingWindow("socket-1", windows, 2, 10_000, "SOCKET_RATE_LIMIT", 1_001);
    expect(() =>
      enforceSlidingWindow("socket-1", windows, 2, 10_000, "SOCKET_RATE_LIMIT", 1_002)
    ).toThrow(/Çok fazla gerçek zamanlı işlem/);
  });

  it("beklenmeyen socket hatasının iç ayrıntısını istemciye göndermez", () => {
    const response = fail(new Error("postgresql://admin:secret@private-host/database"));
    expect(response.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response)).not.toContain("private-host");
  });
});

describe("authoritative game deadline", () => {
  it("rejects actions at or after the server deadline", () => {
    expect(() => assertPhaseOpen({ phaseEndsAt: 999 }, 1_000)).toThrow();
    expect(() => assertPhaseOpen({ phaseEndsAt: 1_001 }, 1_000)).not.toThrow();
  });

  it("ends voting as soon as every living player has voted", () => {
    expect(haveAllAlivePlayersVoted({
      votesCast: 2,
      players: [{ isAlive: true }, { isAlive: true }, { isAlive: false }]
    })).toBe(true);
    expect(haveAllAlivePlayersVoted({
      votesCast: 1,
      players: [{ isAlive: true }, { isAlive: true }, { isAlive: false }]
    })).toBe(false);
    expect(haveAllAlivePlayersVoted({
      votesCast: 2,
      votedPlayerIds: ["disconnected", "active"],
      players: [
        { id: "active", isAlive: true },
        { id: "waiting", isAlive: true },
        { id: "disconnected", isAlive: true, connected: false }
      ]
    })).toBe(false);
    expect(haveAllAlivePlayersVoted({
      votesCast: 2,
      votedPlayerIds: ["active", "waiting"],
      players: [
        { id: "active", isAlive: true },
        { id: "waiting", isAlive: true },
        { id: "disconnected", isAlive: true, connected: false }
      ]
    })).toBe(true);
  });
});

describe("chat abuse controls", () => {
  it("rejects messages over the configured length", () => {
    expect(() => parseChatInput({ channel: "LOBBY", message: "a".repeat(401) })).toThrow();
  });

  it("strips HTML and rejects content that becomes empty", () => {
    expect(sanitizeChatMessage("<b>merhaba</b>")).toBe("merhaba");
    expect(() => sanitizeChatMessage("<img src=x>")).toThrow();
  });

  it("applies the dedicated chat spam limit", () => {
    const windows = new Map<string, number[]>();
    enforceSlidingWindow("player", windows, 1, 10_000, "CHAT_RATE_LIMIT", 1_000);
    expect(() => enforceSlidingWindow("player", windows, 1, 10_000, "CHAT_RATE_LIMIT", 1_001)).toThrow();
  });
});
