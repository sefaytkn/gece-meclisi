import type { Server, Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import { parse as parseCookie } from "cookie";
import sanitizeHtml from "sanitize-html";
import { z, ZodError } from "zod";
import { env } from "../config/env.js";
import { createGuestId, verifySession } from "../utils/tokens.js";
import { fail, ok, type AckCallback } from "../utils/ack.js";
import { RoomService, type RoomState } from "../services/RoomService.js";
import { assertCanUseChat, type ChatChannel } from "../games/vampire-village/chatPermissions.js";
import type { VampirePhase } from "../games/vampire-village/VampireVillageTypes.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

const nicknameSchema = z.string().trim().min(2).max(24);
const guestIdSchema = z.string().regex(/^guest_[a-f0-9]{24}$/);
const chatSchema = z.object({
  channel: z.enum(["LOBBY", "DAY", "VAMPIRE", "DEAD"]),
  message: z.string().trim().min(1).max(400)
});

const phaseDurations = {
  ROLE_REVEAL: 10,
  ROUND_RESULT: 7
} as const;

export function setupSocket(io: Server, roomService = new RoomService()) {
  const timers = new Map<string, NodeJS.Timeout>();
  const villagerTaskTimers = new Map<string, NodeJS.Timeout>();
  const disconnectTimers = new Set<NodeJS.Timeout>();
  const chatWindows = new Map<string, number[]>();
  const eventWindows = new Map<string, number[]>();
  const resolvingPhases = new Set<string>();
  let closing = false;

  io.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const token = cookies[env.COOKIE_NAME];
      const requestedNickname = typeof socket.handshake.auth.nickname === "string" ? socket.handshake.auth.nickname : "";
      const requestedGuestId = socket.handshake.auth.guestId
        ? guestIdSchema.parse(socket.handshake.auth.guestId)
        : "";
      if (token) {
        const session = verifySession(token);
        socket.data.identity = {
          userId: session.sub,
          guestId: requestedGuestId || createGuestId(),
          nickname: session.username,
          socketId: socket.id
        };
      } else {
        socket.data.identity = {
          guestId: requestedGuestId || createGuestId(),
          nickname: nicknameSchema.parse(requestedNickname || `Misafir-${Math.floor(Math.random() * 9000 + 1000)}`),
          socketId: socket.id
        };
      }
      next();
    } catch {
      next(new Error("SOCKET_AUTH_FAILED"));
    }
  });

  const broadcastRoom = (code: string) => {
    try {
      io.to(code).emit("room:state", roomService.getRoom(code));
    } catch {
      // Oda son oyuncu ayrıldığında silinmiş olabilir.
    }
  };

  const emitPrivateState = (code: string) => {
    const room = roomService.getInternalRoom(code);
    if (!room.engine) return;
    room.players.forEach((player) => {
      io.to(player.socketId).emit("game:private-role", room.engine!.getPrivateState(player.id));
    });
  };

  const broadcastGame = (code: string) => {
    const room = roomService.getInternalRoom(code);
    if (!room.engine) return;
    io.to(code).emit("game:state", {
      ...room.engine.getPublicState(),
      phaseEndsAt: room.phaseEndsAt,
      serverNow: Date.now()
    });
    emitPrivateState(code);
  };

  const completePhase = (code: string) => {
    const activeTimer = timers.get(code);
    if (activeTimer) clearTimeout(activeTimer);
    timers.delete(code);
    const villagerTaskTimer = villagerTaskTimers.get(code);
    if (villagerTaskTimer) clearTimeout(villagerTaskTimer);
    villagerTaskTimers.delete(code);
    if (resolvingPhases.has(code)) return;
    resolvingPhases.add(code);
    try {
      const activeRoom = roomService.getInternalRoom(code);
      const previousAlive = new Set(
        activeRoom.engine?.getPublicState().players.filter((player) => player.isAlive).map((player) => player.id) ?? []
      );
      const nextPhase = activeRoom.engine?.advancePhase();
      activeRoom.phaseEndsAt = null;
      const currentState = activeRoom.engine?.getPublicState();
      const eliminated = currentState?.players.find((player) => previousAlive.has(player.id) && !player.isAlive);
      const eliminatedInternal = eliminated ? activeRoom.engine?.getInternalPlayer(eliminated.id) : null;
      const eliminationEvent = eliminated && eliminatedInternal?.deathCause
        ? {
            id: `${currentState?.round ?? 0}:${eliminated.id}:${eliminatedInternal.deathCause}`,
            playerId: eliminated.id,
            nickname: eliminated.nickname,
            cause: eliminatedInternal.deathCause,
            round: currentState?.round ?? 0
          }
        : null;
      if (nextPhase === "FINISHED") {
        activeRoom.status = "FINISHED";
        io.to(code).emit("game:ended", currentState);
        broadcastRoom(code);
        broadcastGame(code);
        if (eliminationEvent) io.to(code).emit("game:player-eliminated", eliminationEvent);
        return;
      }
      if (nextPhase === "ROUND_RESULT") io.to(code).emit("game:round-result", currentState);
      schedulePhase(code);
      if (eliminationEvent) io.to(code).emit("game:player-eliminated", eliminationEvent);
    } catch (error) {
      logger.error("Game phase completion failed", { code, error });
      timers.delete(code);
    } finally {
      resolvingPhases.delete(code);
    }
  };

  const schedulePhase = (code: string) => {
    const room = roomService.getInternalRoom(code);
    if (!room.engine || room.engine.getPhase() === "FINISHED") return;
    const phase = room.engine.getPhase();
    const seconds =
      phase === "NIGHT"
        ? room.settings.nightSeconds
        : phase === "DAY_DISCUSSION"
          ? room.settings.discussionSeconds
          : phase === "DAY_VOTING"
            ? room.settings.votingSeconds
            : phaseDurations[phase as keyof typeof phaseDurations] ?? 5;
    room.phaseEndsAt = Date.now() + seconds * 1000;
    broadcastRoom(code);
    broadcastGame(code);
    io.to(code).emit("game:phase-changed", { phase, phaseEndsAt: room.phaseEndsAt });
    const existing = timers.get(code);
    if (existing) clearTimeout(existing);
    timers.set(
      code,
      setTimeout(() => completePhase(code), seconds * 1000)
    );
    const previousVillagerTaskTimer = villagerTaskTimers.get(code);
    if (previousVillagerTaskTimer) clearTimeout(previousVillagerTaskTimer);
    villagerTaskTimers.delete(code);
    if (phase === "NIGHT") {
      const villagerTaskTimer = setTimeout(() => {
        villagerTaskTimers.delete(code);
        try {
          const activeRoom = roomService.getInternalRoom(code);
          if (activeRoom.engine?.getPhase() !== "NIGHT") return;
          if (activeRoom.engine.haveAllRequiredNightActions()) completePhase(code);
          else broadcastGame(code);
        } catch {
          // Oda görev süresi dolmadan kapanmış olabilir.
        }
      }, 10_050);
      villagerTaskTimers.set(code, villagerTaskTimer);
    }
  };

  const handle =
    <T>(ack: AckCallback<T> | undefined, action: () => T | Promise<T>) =>
    async () => {
      if (typeof ack !== "function") return;
      try {
        ack(ok(await action()));
      } catch (error) {
        if (!(error instanceof AppError) && !(error instanceof ZodError)) {
          logger.error("Unhandled Socket.IO event error", error);
        }
        ack(fail(error));
      }
    };

  io.on("connection", (socket: Socket) => {
    socket.use((packet, next) => {
      try {
        enforceSlidingWindow(actorRateKey(socket), eventWindows, 45, 10_000, "SOCKET_RATE_LIMIT");
        next();
      } catch (error) {
        const acknowledgement = packet.at(-1);
        if (typeof acknowledgement === "function") acknowledgement(fail(error));
      }
    });
    socket.emit("session:ready", {
      guestId: socket.data.identity.guestId,
      nickname: socket.data.identity.nickname,
      authenticated: Boolean(socket.data.identity.userId)
    });

    socket.on("room:create", (input, ack) => {
      void handle(ack, async () => {
        enforceSlidingWindow(`${actorRateKey(socket)}:room:create`, eventWindows, 3, 60_000, "SOCKET_RATE_LIMIT");
        const result = await roomService.createRoom(input, socket.data.identity);
        socket.data.roomCode = result.room.code;
        socket.data.playerId = result.playerId;
        await socket.join(result.room.code);
        broadcastRoom(result.room.code);
        return result;
      })();
    });

    socket.on("room:join", (input, ack) => {
      void handle(ack, async () => {
        enforceSlidingWindow(`${actorRateKey(socket)}:room:join`, eventWindows, 12, 60_000, "SOCKET_RATE_LIMIT");
        const result = await roomService.joinRoom(input ?? {}, socket.data.identity);
        const replacedSocket = io.sockets.sockets.get(result.replacedSocketId ?? "");
        if (replacedSocket && replacedSocket.id !== socket.id) {
          replacedSocket.emit("session:replaced");
          replacedSocket.data.roomCode = undefined;
          replacedSocket.data.playerId = undefined;
          replacedSocket.disconnect(true);
        }
        socket.data.roomCode = result.room.code;
        socket.data.playerId = result.playerId;
        await socket.join(result.room.code);
        broadcastRoom(result.room.code);
        if (result.privateState) {
          socket.emit("game:private-role", result.privateState);
          const room = roomService.getInternalRoom(result.room.code);
          if (room.engine) {
            socket.emit("game:state", {
              ...room.engine.getPublicState(),
              phaseEndsAt: room.phaseEndsAt,
              serverNow: Date.now()
            });
          }
        }
        io.to(result.room.code).emit("chat:system-message", systemMessage(`${socket.data.identity.nickname} odaya katıldı.`));
        const { replacedSocketId: _replacedSocketId, ...publicResult } = result;
        return publicResult;
      })();
    });

    socket.on("room:leave", (_input, ack) => {
      void handle(ack, async () => {
        const { roomCode, playerId } = requireMembership(socket);
        const result = roomService.leaveRoom(roomCode, playerId);
        await socket.leave(roomCode);
        socket.data.roomCode = undefined;
        socket.data.playerId = undefined;
        if (!result.deleted) {
          broadcastRoom(roomCode);
          io.to(roomCode).emit("chat:system-message", systemMessage(`${socket.data.identity.nickname} odadan ayrıldı.`));
        } else {
          const timer = timers.get(roomCode);
          if (timer) clearTimeout(timer);
          timers.delete(roomCode);
          const villagerTaskTimer = villagerTaskTimers.get(roomCode);
          if (villagerTaskTimer) clearTimeout(villagerTaskTimer);
          villagerTaskTimers.delete(roomCode);
        }
        return result;
      })();
    });

    socket.on("room:ready", (input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const { ready } = z.object({ ready: z.boolean() }).parse(input);
        const room = roomService.setReady(roomCode, playerId, ready);
        broadcastRoom(roomCode);
        return { room };
      })();
    });

    socket.on("room:update-settings", (input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const result =
          input?.settings !== undefined
            ? roomService.updateSettings(roomCode, playerId, input.settings)
            : { room: roomService.updateRoomDetails(roomCode, playerId, input ?? {}), validation: null };
        broadcastRoom(roomCode);
        return result;
      })();
    });

    socket.on("room:kick", (input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const targetId = z.string().uuid().parse(input?.targetId);
        const room = roomService.getInternalRoom(roomCode);
        const target = room.players.find((player) => player.id === targetId);
        const result = roomService.kickPlayer(roomCode, playerId, targetId);
        if (target) io.to(target.socketId).emit("room:kicked", { code: roomCode });
        broadcastRoom(roomCode);
        return result;
      })();
    });

    socket.on("room:transfer-owner", (input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const room = roomService.transferOwner(roomCode, playerId, z.string().uuid().parse(input?.targetId));
        broadcastRoom(roomCode);
        return { room };
      })();
    });

    socket.on("room:start", (_input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const result = roomService.startGame(roomCode, playerId);
        io.to(roomCode).emit("game:started", {
          ...result.engine.getPublicState(),
          phaseEndsAt: result.room.phaseEndsAt,
          serverNow: Date.now()
        });
        emitPrivateState(roomCode);
        broadcastRoom(roomCode);
        schedulePhase(roomCode);
        return { room: result.room };
      })();
    });

    socket.on("room:rematch", (_input, ack) => {
      void handle(ack, () => {
        const { roomCode, playerId } = requireMembership(socket);
        const room = roomService.rematch(roomCode, playerId);
        broadcastRoom(roomCode);
        return { room };
      })();
    });

    socket.on("game:night-action", (input, ack) => {
      void handle(ack, () => {
        enforceSlidingWindow(`${actorRateKey(socket)}:night-action`, eventWindows, 5, 10_000, "SOCKET_RATE_LIMIT");
        const { roomCode, playerId } = requireMembership(socket);
        const room = roomService.getInternalRoom(roomCode);
        if (!room.engine) throw new AppError("GAME_NOT_STARTED", "Oyun henüz başlamadı.");
        assertPhaseOpen(room);
        const boundAction = bindGameAction(playerId, "NIGHT_ACTION", input);
        room.engine.handleAction(boundAction.actorPlayerId, boundAction.action);
        if (room.engine.haveAllRequiredNightActions()) completePhase(roomCode);
        else broadcastGame(roomCode);
        return { accepted: true };
      })();
    });

    socket.on("game:vote", (input, ack) => {
      void handle(ack, () => {
        enforceSlidingWindow(`${actorRateKey(socket)}:vote`, eventWindows, 8, 10_000, "SOCKET_RATE_LIMIT");
        const { roomCode, playerId } = requireMembership(socket);
        const room = roomService.getInternalRoom(roomCode);
        if (!room.engine) throw new AppError("GAME_NOT_STARTED", "Oyun henüz başlamadı.");
        assertPhaseOpen(room);
        const boundAction = bindGameAction(playerId, "VOTE", input);
        room.engine.handleAction(boundAction.actorPlayerId, boundAction.action);
        const publicState = room.engine.getPublicState();
        io.to(roomCode).emit(
          "game:vote-updated",
          room.settings.voteVisibility === "PUBLIC"
            ? { voterId: playerId, targetId: boundAction.action.targetId, votesCast: publicState.votesCast }
            : { votesCast: publicState.votesCast }
        );
        if (haveAllAlivePlayersVoted(publicState)) completePhase(roomCode);
        else broadcastGame(roomCode);
        return { accepted: true };
      })();
    });

    socket.on("chat:send", (rawInput, ack) => {
      void handle(ack, () => {
        const input = parseChatInput(rawInput);
        enforceChatRate(actorRateKey(socket), chatWindows);
        const { roomCode, playerId } = requireMembership(socket);
        const room = roomService.getInternalRoom(roomCode);
        if (input.channel === "LOBBY") {
          if (room.status !== "WAITING") throw new AppError("CHAT_CHANNEL_CLOSED", "Lobi sohbeti oyun başlayınca kapanır.");
        } else {
          if (!room.engine) throw new AppError("GAME_NOT_STARTED", "Oyun henüz başlamadı.");
          const player = room.engine.getInternalPlayer(playerId);
          if (!player) throw new AppError("PLAYER_NOT_FOUND", "Oyuncu bulunamadı.");
          assertCanUseChat(player, room.engine.getPhase() as VampirePhase, input.channel as ChatChannel);
        }
        const sanitizedMessage = sanitizeChatMessage(input.message);
        const message = {
          id: randomUUID(),
          username: socket.data.identity.nickname,
          playerId,
          sentAt: new Date().toISOString(),
          type: input.channel,
          isSystem: false,
          message: sanitizedMessage
        };
        if (input.channel === "VAMPIRE" || input.channel === "DEAD") {
          const recipients = getChatRecipientSocketIds(room, input.channel);
          io.to(recipients).emit("chat:message", message);
        } else {
          io.to(roomCode).emit("chat:message", message);
        }
        return { message };
      })();
    });

    socket.on("disconnect", () => {
      chatWindows.delete(socket.id);
      eventWindows.delete(socket.id);
      if (closing) return;
      const disconnected = roomService.disconnect(socket.id);
      if (!disconnected) return;
      const { room, player } = disconnected;
      broadcastRoom(room.code);
      const publicState = room.engine?.getPublicState();
      if (room.engine?.getPhase() === "NIGHT" && room.engine.haveAllRequiredNightActions()) {
        completePhase(room.code);
      } else if (room.engine?.getPhase() === "DAY_VOTING" && publicState && haveAllAlivePlayersVoted(publicState)) {
        completePhase(room.code);
      }
      const disconnectTimer = setTimeout(() => {
        disconnectTimers.delete(disconnectTimer);
        const result = roomService.expireDisconnected(room.code, player.id);
        if (result && !result.deleted) {
          broadcastRoom(room.code);
        } else if (result?.deleted) {
          const timer = timers.get(room.code);
          if (timer) clearTimeout(timer);
          timers.delete(room.code);
          const villagerTaskTimer = villagerTaskTimers.get(room.code);
          if (villagerTaskTimer) clearTimeout(villagerTaskTimer);
          villagerTaskTimers.delete(room.code);
        }
      }, env.RECONNECT_GRACE_MS);
      disconnectTimers.add(disconnectTimer);
    });
  });

  return {
    roomService,
    close() {
      closing = true;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      villagerTaskTimers.forEach((timer) => clearTimeout(timer));
      villagerTaskTimers.clear();
      disconnectTimers.forEach((timer) => clearTimeout(timer));
      disconnectTimers.clear();
      chatWindows.clear();
      eventWindows.clear();
    }
  };
}

function requireMembership(socket: Socket) {
  if (!socket.data.roomCode || !socket.data.playerId) {
    throw new AppError("ROOM_MEMBERSHIP_REQUIRED", "Önce bir odaya katılmalısınız.", 403);
  }
  return { roomCode: socket.data.roomCode, playerId: socket.data.playerId };
}

function systemMessage(message: string) {
  return {
    id: randomUUID(),
    username: "Sistem",
    sentAt: new Date().toISOString(),
    type: "SYSTEM",
    isSystem: true,
    message
  };
}

function actorRateKey(socket: Socket) {
  return socket.data.identity.userId ?? socket.data.identity.guestId ?? socket.id;
}

export function parseChatInput(input: unknown) {
  return chatSchema.parse(input);
}

export function sanitizeChatMessage(message: string) {
  const sanitized = sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} }).trim();
  if (!sanitized) throw new AppError("EMPTY_CHAT_MESSAGE", "Mesaj boş olamaz.");
  return sanitized;
}

export function assertPhaseOpen(room: Pick<RoomState, "phaseEndsAt">, now = Date.now()) {
  if (room.phaseEndsAt === null || now >= room.phaseEndsAt) {
    throw new AppError("PHASE_EXPIRED", "Bu aşamanın süresi doldu.");
  }
}

export function haveAllAlivePlayersVoted(state: {
  votesCast: number;
  votedPlayerIds?: string[];
  players: { id?: string; isAlive: boolean; connected?: boolean }[];
}) {
  const activeAlivePlayers = state.players.filter((player) => player.isAlive && player.connected !== false);
  if (activeAlivePlayers.length === 0) return false;
  if (state.votedPlayerIds && activeAlivePlayers.every((player) => player.id)) {
    const votedPlayerIds = new Set(state.votedPlayerIds);
    return activeAlivePlayers.every((player) => votedPlayerIds.has(player.id!));
  }
  return state.votesCast >= activeAlivePlayers.length;
}

function enforceChatRate(socketId: string, windows: Map<string, number[]>) {
  enforceSlidingWindow(socketId, windows, 6, 10_000, "CHAT_RATE_LIMIT");
}

export function enforceSlidingWindow(
  key: string,
  windows: Map<string, number[]>,
  limit: number,
  windowMs: number,
  code: "CHAT_RATE_LIMIT" | "SOCKET_RATE_LIMIT",
  now = Date.now()
) {
  if (windows.size >= 10_000) {
    for (const [windowKey, timestamps] of windows) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) windows.delete(windowKey);
    }
  }
  const recent = (windows.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) {
    throw new AppError(
      code,
      code === "CHAT_RATE_LIMIT"
        ? "Çok hızlı mesaj gönderiyorsunuz. Biraz bekleyin."
        : "Çok fazla gerçek zamanlı işlem gönderildi. Biraz bekleyin.",
      429
    );
  }
  recent.push(now);
  windows.set(key, recent);
}

export function getChatRecipientSocketIds(
  room: RoomState,
  channel: "VAMPIRE" | "DEAD"
) {
  return room.players
    .filter((player) => {
      const internal = room.engine?.getInternalPlayer(player.id);
      return channel === "VAMPIRE"
        ? internal?.isAlive && internal.role === "VAMPIRE"
        : internal && !internal.isAlive;
    })
    .map((player) => player.socketId);
}

export function bindGameAction(
  actorPlayerId: string,
  type: "NIGHT_ACTION" | "VOTE",
  rawInput: unknown
) {
  const { targetId } = z.object({ targetId: z.string().min(1) }).parse(rawInput);
  return {
    actorPlayerId,
    action: { type, targetId }
  } as const;
}
