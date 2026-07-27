import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}
