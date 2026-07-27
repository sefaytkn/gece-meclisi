import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn()
}));

vi.mock("./prisma/client.js", () => ({ prisma: { user: userMocks } }));

import { createApp } from "./app.js";
import { env } from "./config/env.js";

const password = "correct-horse-battery-staple";
const baseUser = {
  id: "user-1",
  username: "oyuncu_1",
  email: "oyuncu@example.com",
  avatarUrl: null,
  createdAt: new Date("2026-07-21T00:00:00.000Z"),
  updatedAt: new Date("2026-07-21T00:00:00.000Z"),
  passwordHash: ""
};

function app() {
  return createApp({ healthCheck: async () => true, apiRateLimitMax: 1_000 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth routes", () => {
  it("registers a user, normalizes email and sets an HttpOnly cookie", async () => {
    userMocks.findFirst.mockResolvedValue(null);
    userMocks.create.mockResolvedValue({
      id: baseUser.id,
      username: baseUser.username,
      email: baseUser.email,
      avatarUrl: baseUser.avatarUrl,
      createdAt: baseUser.createdAt
    });

    const response = await request(app()).post("/api/auth/register").send({
      username: baseUser.username,
      email: "OYUNCU@EXAMPLE.COM",
      password
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(userMocks.create.mock.calls[0]?.[0].data.email).toBe(baseUser.email);
    expect(response.headers["set-cookie"]?.[0]).toContain(`${env.COOKIE_NAME}=`);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
  });

  it("rejects a duplicate email", async () => {
    userMocks.findFirst.mockResolvedValue({ email: baseUser.email, username: baseUser.username });
    const response = await request(app()).post("/api/auth/register").send({
      username: baseUser.username,
      email: baseUser.email,
      password
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("logs in with a case-insensitive username without returning the password hash", async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    userMocks.findFirst.mockResolvedValue({ ...baseUser, passwordHash });
    const response = await request(app()).post("/api/auth/login").send({
      username: baseUser.username.toUpperCase(),
      password
    });
    expect(response.status).toBe(200);
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(userMocks.findFirst).toHaveBeenCalledWith({
      where: { username: { equals: baseUser.username.toUpperCase(), mode: "insensitive" } }
    });
  });

  it("rejects a wrong password with a generic error", async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    userMocks.findFirst.mockResolvedValue({ ...baseUser, passwordHash });
    const response = await request(app()).post("/api/auth/login").send({
      username: baseUser.username,
      password: "definitely-wrong"
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns an anonymous session for missing, malformed and expired auth cookies", async () => {
    const noCookie = await request(app()).get("/api/auth/me");
    const malformed = await request(app()).get("/api/auth/me").set("Cookie", `${env.COOKIE_NAME}=not-a-jwt`);
    const expiredToken = jwt.sign(
      { sub: baseUser.id, username: baseUser.username, email: baseUser.email },
      env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const expired = await request(app()).get("/api/auth/me").set("Cookie", `${env.COOKIE_NAME}=${expiredToken}`);
    expect([noCookie, malformed, expired].map((response) => response.status)).toEqual([200, 200, 200]);
    expect([noCookie, malformed, expired].map((response) => response.body.data.user)).toEqual([null, null, null]);
  });

  it("returns the current user for a valid session and clears it on logout", async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    userMocks.findFirst.mockResolvedValue({ ...baseUser, passwordHash });
    userMocks.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    const agent = request.agent(app());
    const login = await agent.post("/api/auth/login").send({ username: baseUser.username, password });
    expect(login.status).toBe(200);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(baseUser.email);
    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.[0]).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
  });
});
