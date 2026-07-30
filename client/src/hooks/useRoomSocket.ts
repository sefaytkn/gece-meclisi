import { useCallback, useEffect, useState } from "react";
import { connectSocket, emitAck, socket } from "../services/socket";
import { joinRoomOnce } from "../services/roomJoin";
import { getRoomSession, saveRoomSession } from "../services/roomSession";
import type { ChatMessage, GameState, PlayerElimination, PrivateState, Room } from "../types";

export function useRoomSocket(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [elimination, setElimination] = useState<PlayerElimination | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting" | "offline">(
    socket.connected ? "connected" : "connecting"
  );
  const session = getRoomSession(code);

  useEffect(() => {
    const onRoom = (next: Room) => setRoom(next);
    const onGame = (next: GameState) => setGame(next);
    const onPrivate = (next: PrivateState) => setPrivateState(next);
    const onElimination = (next: PlayerElimination) => setElimination(next);
    const onMessage = (message: ChatMessage) => setMessages((current) => [...current.slice(-99), message]);
    const onConnect = () => {
      setConnectionState("connected");
      setError("");
      void join();
    };
    const onDisconnect = () => setConnectionState(socket.active ? "reconnecting" : "offline");
    const onConnectError = () => setConnectionState(socket.active ? "reconnecting" : "offline");
    const onSessionReplaced = () => {
      setConnectionState("offline");
      setError("Bu oturum başka bir sekmede açıldı.");
    };
    const onKicked = () => {
      setConnectionState("offline");
      setError("Oda sahibi tarafından odadan çıkarıldınız.");
    };
    socket.on("room:state", onRoom);
    socket.on("game:state", onGame);
    socket.on("game:started", onGame);
    socket.on("game:ended", onGame);
    socket.on("game:private-role", onPrivate);
    socket.on("game:player-eliminated", onElimination);
    socket.on("chat:message", onMessage);
    socket.on("chat:system-message", onMessage);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("session:replaced", onSessionReplaced);
    socket.on("room:kicked", onKicked);
    connectSocket(session?.nickname);

    async function join() {
      try {
        const result = await joinRoomOnce(code, session?.reconnectToken);
        setRoom(result.room);
        if (result.privateState) setPrivateState(result.privateState);
        saveRoomSession(result.room, result.playerId, result.reconnectToken, session?.nickname ?? "Oyuncu");
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Odaya bağlanılamadı.");
      }
    }
    if (socket.connected) void join();

    return () => {
      socket.off("room:state", onRoom);
      socket.off("game:state", onGame);
      socket.off("game:started", onGame);
      socket.off("game:ended", onGame);
      socket.off("game:private-role", onPrivate);
      socket.off("game:player-eliminated", onElimination);
      socket.off("chat:message", onMessage);
      socket.off("chat:system-message", onMessage);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("session:replaced", onSessionReplaced);
      socket.off("room:kicked", onKicked);
    };
  }, [code, session?.nickname, session?.reconnectToken]);

  const sendChat = useCallback(async (channel: ChatMessage["type"], message: string) => {
    await emitAck("chat:send", { channel, message });
  }, []);

  return { room, game, privateState, elimination, messages, error, session, sendChat, connectionState };
}
