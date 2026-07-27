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

function waitForConnection(timeoutMs = 65_000): Promise<void> {
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      socket.off("connect", onConnect);
      reject(new Error("Sunucu uyandırılamadı. Lütfen kısa bir süre sonra tekrar deneyin."));
    }, timeoutMs);
    const onConnect = () => {
      window.clearTimeout(timer);
      resolve();
    };

    socket.once("connect", onConnect);
    if (!socket.active) socket.connect();
  });
}

export async function emitAck<T>(event: string, payload: unknown = {}): Promise<T> {
  await waitForConnection();

  return new Promise((resolve, reject) => {
    socket.timeout(15_000).emit(event, payload, (timeoutError: Error | null, response: Ack<T>) => {
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
