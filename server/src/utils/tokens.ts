import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface SessionPayload {
  sub: string;
  username: string;
  email: string;
}

export const signSession = (payload: SessionPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });

export const verifySession = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as SessionPayload;

export const createOpaqueToken = () => randomBytes(32).toString("base64url");
export const createGuestId = () => `guest_${randomBytes(12).toString("hex")}`;
