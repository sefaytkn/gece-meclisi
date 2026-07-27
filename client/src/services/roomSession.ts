import type { Room } from "../types";

export interface StoredRoomSession {
  code: string;
  playerId: string;
  reconnectToken: string;
  nickname: string;
}

const key = (code: string) => `gece:room:${code.toUpperCase()}`;

export function saveRoomSession(room: Room, playerId: string, reconnectToken: string, nickname: string) {
  const session: StoredRoomSession = { code: room.code, playerId, reconnectToken, nickname };
  localStorage.setItem(key(room.code), JSON.stringify(session));
  return session;
}

export function getRoomSession(code: string): StoredRoomSession | null {
  const value = localStorage.getItem(key(code));
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredRoomSession;
  } catch {
    return null;
  }
}

export function clearRoomSession(code: string) {
  localStorage.removeItem(key(code));
}
