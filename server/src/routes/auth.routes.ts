import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { env } from "../config/env.js";
import { signSession } from "../utils/tokens.js";
import { getClearCookieOptions, getSessionCookieOptions } from "../config/cookie.js";
import { rateLimit } from "express-rate-limit";

const router = Router();
const passwordSchema = z.string().min(8).max(72);
const usernameSchema = z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_-]+$/u);
const registerSchema = z.object({
  email: z.string().trim().email().max(160),
  password: passwordSchema,
  username: usernameSchema
});
const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema
});

const cookieOptions = getSessionCookieOptions(env);
const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: "AUTH_RATE_LIMITED", message: "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin." }
  }
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "REGISTER_RATE_LIMITED",
      message: "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin."
    }
  }
});

router.post("/register", registerRateLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = input.email.toLowerCase();
    const username = input.username.trim();
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: { equals: username, mode: "insensitive" } }] },
      select: { email: true, username: true }
    });
    if (exists) {
      res.status(409).json({
        success: false,
        error: {
          code: exists.email === email ? "EMAIL_IN_USE" : "USERNAME_IN_USE",
          message: exists.email === email ? "Bu e-posta zaten kullanılıyor." : "Bu kullanıcı adı zaten kullanılıyor."
        }
      });
      return;
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true }
    });
    res.cookie(env.COOKIE_NAME, signSession({ sub: user.id, username: user.username, email: user.email }), cookieOptions);
    res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" } }
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Kullanıcı adı veya şifre hatalı." } });
      return;
    }
    res.cookie(env.COOKIE_NAME, signSession({ sub: user.id, username: user.username, email: user.email }), cookieOptions);
    res.json({ success: true, data: { user: { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, createdAt: user.createdAt } } });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, getClearCookieOptions(env));
  res.json({ success: true, data: null });
});

router.get("/me", async (req, res) => {
  if (!req.user) {
    res.json({ success: true, data: { user: null } });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true }
  });
  res.json({ success: true, data: { user } });
});

export default router;
