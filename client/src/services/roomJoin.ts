import type { PrivateState, Room } from "../types";
import { emitAck } from "./socket";

export interface RoomJoinResult {
  room: Room;
  playerId: string;
  reconnectToken: string;
  privateState: PrivateState | null;
}

const pendingJoins = new Map<string, Promise<RoomJoinResult>>();

export function joinRoomOnce(code: string, reconnectToken?: string) {
  const normalizedCode = code.toUpperCase();
  const key = `${normalizedCode}:${reconnectToken ?? ""}`;
  const existing = pendingJoins.get(key);
  if (existing) return existing;

  const pending = emitAck<RoomJoinResult>("room:join", {
    code: normalizedCode,
    reconnectToken
  }).finally(() => {
    if (pendingJoins.get(key) === pending) pendingJoins.delete(key);
  });
  pendingJoins.set(key, pending);
  return pending;
}

export function resetPendingRoomJoinsForTests() {
  pendingJoins.clear();
}
