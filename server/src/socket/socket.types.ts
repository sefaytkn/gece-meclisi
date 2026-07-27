import type { SocketIdentity } from "../services/RoomService.js";

declare module "socket.io" {
  interface SocketData {
    identity: SocketIdentity;
    roomCode?: string;
    playerId?: string;
  }
}
