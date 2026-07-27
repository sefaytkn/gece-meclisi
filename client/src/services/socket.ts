import { io } from "socket.io-client";
import type { Ack } from "../types";
import { clientEnv } from "../config/env";

export const socket = io(clientEnv.SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"]
});

export function connectSocket(nickname?: string) {
  const guestId = localStorage.getItem("gece:guestId") ?? undefined;
  socket.auth = { nickname, guestId };
  if (!socket.connected && !socket.active) socket.connect();
}

socket.on("session:ready", (session: { guestId: string }) => {
  localStorage.setItem("gece:guestId", session.guestId);
});

export function emitAck<T>(event: string, payload: unknown = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (timeoutError: Error | null, response: Ack<T>) => {
      if (timeoutError) {
        reject(new Error("Sunucu yanıt vermedi. Bağlantınızı kontrol edin."));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error?.message ?? "İşlem tamamlanamadı."));
        return;
      }
      resolve(response.data);
    });
  });
}
