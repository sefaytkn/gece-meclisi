import type { CookieOptions } from "express";
import type { ServerEnv } from "./env.js";

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionCookieOptions(appEnv: ServerEnv): CookieOptions {
  return {
    httpOnly: true,
    secure: appEnv.COOKIE_SECURE,
    sameSite: appEnv.COOKIE_SAME_SITE,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/"
  };
}

export function getClearCookieOptions(appEnv: ServerEnv): CookieOptions {
  const { maxAge: _maxAge, ...options } = getSessionCookieOptions(appEnv);
  return options;
}
