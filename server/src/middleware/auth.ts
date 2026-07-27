import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifySession } from "../utils/tokens.js";

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME] as string | undefined;
  if (token) {
    try {
      const session = verifySession(token);
      req.user = { id: session.sub, username: session.username, email: session.email };
    } catch {
      req.user = undefined;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Oturum açmanız gerekiyor." } });
    return;
  }
  next();
}
