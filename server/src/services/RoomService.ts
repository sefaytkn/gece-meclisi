import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";
import { createOpaqueToken } from "../utils/tokens.js";
import { generateRoomCode } from "../utils/roomCode.js";
import { GameRegistry } from "../games/core/GameRegistry.js";
import { VampireVillageEngine } from "../games/vampire-village/VampireVillageEngine.js";
import { validateRoleDistribution } from "../games/vampire-village/validation.js";
import type { VampireVillageSettings } from "../games/vampire-village/VampireVillageTypes.js";
import { InMemoryStateStore, type StateStore } from "./state/StateStore.js";

export type RoomStatus = "WAITING" | "STARTING" | "PLAYING" | "FINISHED";

export interface SocketIdentity {
  userId?: string;
  guestId: string;
  nickname: string;
  socketId: string;
}

export interface RoomPlayerState {
  id: string;
  userId?: string;
  guestId: string;
  nickname: string;
  isReady: boolean;
  isAlive: boolean;
  isConnected: boolean;
  socketId: string;
  reconnectToken: string;
  joinedAt: number;
}

export interface RoomState {
  id: string;
  code: string;
  name: string;
  gameSlug: "vampire-village";
  ownerPlayerId: string;
  status: RoomStatus;
  maxPlayers: number;
  passwordHash: string | null;
  settings: VampireVillageSettings;
  players: RoomPlayerState[];
  engine: VampireVillageEngine | null;
  phaseEndsAt: number | null;
}

const roomCreateSchema = z.object({
  name: z.string().trim().min(3).max(42),
  maxPlayers: z.number().int().min(4).max(16),
  password: z.string().max(32).optional().default("")
});

const roomJoinSchema = z.object({
  code: z.string().trim().length(6).transform((value) => value.toUpperCase()),
  password: z.string().max(32).optional(),
  reconnectToken: z.string().min(1).max(128).optional()
});

const settingsSchema = z.object({
  mode: z.enum(["BALANCED", "FREE"]),
  roles: z.object({
    vampires: z.number().int().min(0).max(16),
    villagers: z.number().int().min(0).max(16),
    doctors: z.number().int().min(0).max(16)
  }),
  discussionSeconds: z.number().int().min(15).max(300),
  nightSeconds: z.number().int().min(15).max(180),
  votingSeconds: z.number().int().min(15).max(180),
  doctorCanSelfProtect: z.boolean(),
  doctorCanRepeatTarget: z.boolean(),
  vampireTieRule: z.enum(["NO_KILL", "RANDOM"]),
  votingTieRule: z.enum(["NO_ELIMINATION", "REVOTE", "RANDOM"]),
  canChangeVote: z.boolean(),
  canSelfVote: z.boolean(),
  voteVisibility: z.enum(["SECRET", "PUBLIC"]),
  deadCanSeeRoles: z.boolean()
});

const defaultSettings = (): VampireVillageSettings => ({
  mode: "BALANCED",
  roles: { vampires: 1, villagers: 0, doctors: 0 },
  discussionSeconds: 90,
  nightSeconds: 45,
  votingSeconds: 45,
  doctorCanSelfProtect: true,
  doctorCanRepeatTarget: false,
  vampireTieRule: "NO_KILL",
  votingTieRule: "NO_ELIMINATION",
  canChangeVote: true,
  canSelfVote: false,
  voteVisibility: "SECRET",
  deadCanSeeRoles: true
});

export class RoomService {
  private readonly registry = new GameRegistry();

  constructor(private readonly rooms: StateStore<RoomState> = new InMemoryStateStore()) {}

  async createRoom(rawInput: unknown, identity: SocketIdentity) {
    const input = roomCreateSchema.parse(rawInput);
    let code = generateRoomCode();
    while (this.rooms.get(code)) code = generateRoomCode();
    const player = this.createPlayer(identity);
    const room: RoomState = {
      id: randomUUID(),
      code,
      name: input.name,
      gameSlug: "vampire-village",
      ownerPlayerId: player.id,
      status: "WAITING",
      maxPlayers: input.maxPlayers,
      passwordHash: input.password ? await bcrypt.hash(input.password, 10) : null,
      settings: defaultSettings(),
      players: [player],
      engine: null,
      phaseEndsAt: null
    };
    this.rooms.set(code, room);
    return { room: this.publicRoom(room), playerId: player.id, reconnectToken: player.reconnectToken };
  }

  async joinRoom(rawInput: unknown, identity: SocketIdentity) {
    const input = roomJoinSchema.parse(rawInput);
    const code = input.code;
    const room = this.requireRoom(code);
    const reconnecting = input.reconnectToken
      ? room.players.find((player) => player.reconnectToken === input.reconnectToken)
      : undefined;

    if (input.reconnectToken && !reconnecting) {
      throw new AppError("INVALID_RECONNECT_TOKEN", "Yeniden bağlanma anahtarı geçersiz.");
    }

    if (reconnecting) {
      const replacedSocketId = reconnecting.socketId;
      const sameIdentity =
        (reconnecting.userId && reconnecting.userId === identity.userId) ||
        reconnecting.guestId === identity.guestId;
      if (!sameIdentity) throw new AppError("INVALID_RECONNECT_TOKEN", "Yeniden bağlanma anahtarı bu oyuncuya ait değil.");
      reconnecting.socketId = identity.socketId;
      reconnecting.isConnected = true;
      room.engine?.reconnectPlayer(reconnecting.id);
      return {
        room: this.publicRoom(room),
        playerId: reconnecting.id,
        reconnectToken: reconnecting.reconnectToken,
        privateState: room.engine?.getPrivateState(reconnecting.id) ?? null,
        replacedSocketId
      };
    }

    if (room.status !== "WAITING") throw new AppError("GAME_IN_PROGRESS", "Oyun başladıktan sonra odaya katılamazsınız.");
    if (room.players.length >= room.maxPlayers) throw new AppError("ROOM_FULL", "Oda dolu.");
    if (room.passwordHash && !(await bcrypt.compare(input.password ?? "", room.passwordHash))) {
      throw new AppError("INVALID_ROOM_PASSWORD", "Oda şifresi hatalı.");
    }
    const duplicate = room.players.find(
      (player) => (identity.userId && player.userId === identity.userId) || player.guestId === identity.guestId
    );
    if (duplicate) throw new AppError("ALREADY_IN_ROOM", "Bu oyuncu zaten odada.");
    const player = this.createPlayer(identity);
    const previousCount = room.players.length;
    room.players.push(player);
    if (this.totalRoles(room.settings) === previousCount) room.settings.roles.villagers += 1;
    return { room: this.publicRoom(room), playerId: player.id, reconnectToken: player.reconnectToken, privateState: null };
  }

  leaveRoom(code: string, playerId: string) {
    const room = this.requireRoom(code);
    const index = room.players.findIndex((player) => player.id === playerId);
    if (index < 0) throw new AppError("PLAYER_NOT_FOUND", "Oyuncu odada bulunamadı.", 404);
    const [leaving] = room.players.splice(index, 1);
    room.engine?.removePlayer(playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { deleted: true, room: null, transferredTo: null };
    }
    let transferredTo: string | null = null;
    if (room.ownerPlayerId === leaving!.id) {
      room.ownerPlayerId = room.players[0]!.id;
      transferredTo = room.ownerPlayerId;
    }
    if (room.status === "WAITING" && this.totalRoles(room.settings) > room.players.length) {
      if (room.settings.roles.villagers > 0) room.settings.roles.villagers -= 1;
      else if (room.settings.roles.doctors > 0) room.settings.roles.doctors -= 1;
      else if (room.settings.roles.vampires > 1) room.settings.roles.vampires -= 1;
    }
    return { deleted: false, room: this.publicRoom(room), transferredTo };
  }

  setReady(code: string, playerId: string, ready: boolean) {
    const room = this.requireWaitingRoom(code);
    const player = this.requirePlayer(room, playerId);
    player.isReady = ready;
    return this.publicRoom(room);
  }

  updateSettings(code: string, playerId: string, rawSettings: unknown) {
    const room = this.requireWaitingRoom(code);
    this.requireOwner(room, playerId);
    room.settings = settingsSchema.parse(rawSettings);
    return {
      room: this.publicRoom(room),
      validation: validateRoleDistribution(room.players.length, room.settings.roles, room.settings.mode)
    };
  }

  updateRoomDetails(code: string, playerId: string, input: { name?: string; maxPlayers?: number }) {
    const room = this.requireWaitingRoom(code);
    this.requireOwner(room, playerId);
    if (input.name !== undefined) room.name = z.string().trim().min(3).max(42).parse(input.name);
    if (input.maxPlayers !== undefined) {
      const maxPlayers = z.number().int().min(4).max(16).parse(input.maxPlayers);
      if (maxPlayers < room.players.length) throw new AppError("MAX_PLAYERS_TOO_LOW", "Maksimum oyuncu sayısı mevcut oyunculardan az olamaz.");
      room.maxPlayers = maxPlayers;
    }
    return this.publicRoom(room);
  }

  kickPlayer(code: string, ownerId: string, targetId: string) {
    const room = this.requireWaitingRoom(code);
    this.requireOwner(room, ownerId);
    if (ownerId === targetId) throw new AppError("CANNOT_KICK_SELF", "Oda sahibi kendisini atamaz.");
    return this.leaveRoom(code, targetId);
  }

  transferOwner(code: string, ownerId: string, targetId: string) {
    const room = this.requireWaitingRoom(code);
    this.requireOwner(room, ownerId);
    this.requirePlayer(room, targetId);
    room.ownerPlayerId = targetId;
    return this.publicRoom(room);
  }

  startGame(code: string, playerId: string) {
    const room = this.requireWaitingRoom(code);
    this.requireOwner(room, playerId);
    if (room.players.length < 4) throw new AppError("NOT_ENOUGH_PLAYERS", "Oyunu başlatmak için en az 4 oyuncu gerekir.");
    if (room.players.some((player) => !player.isReady)) {
      throw new AppError("PLAYERS_NOT_READY", "Tüm oyuncular hazır olmadan oyun başlatılamaz.");
    }
    const validation = validateRoleDistribution(room.players.length, room.settings.roles, room.settings.mode);
    if (!validation.valid) {
      const error = validation.errors[0]!;
      throw new AppError(error.code, error.message);
    }
    const engine = this.registry.create(
      room.gameSlug,
      room.players.map(({ id, nickname }) => ({ id, nickname })),
      room.settings
    ) as VampireVillageEngine;
    engine.start();
    room.engine = engine;
    room.status = "PLAYING";
    return { room: this.publicRoom(room), engine };
  }

  rematch(code: string, playerId: string) {
    const room = this.requireRoom(code);
    this.requireOwner(room, playerId);
    if (room.status !== "FINISHED") throw new AppError("GAME_NOT_FINISHED", "Yeni oyun yalnızca maç bittikten sonra hazırlanabilir.");
    room.status = "WAITING";
    room.engine = null;
    room.phaseEndsAt = null;
    room.players.forEach((player) => {
      player.isAlive = true;
      player.isReady = false;
    });
    return this.publicRoom(room);
  }

  disconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((candidate) => candidate.socketId === socketId);
      if (player) {
        player.isConnected = false;
        room.engine?.setConnected(player.id, false);
        return { room, player };
      }
    }
    return null;
  }

  expireDisconnected(code: string, playerId: string) {
    const room = this.rooms.get(code);
    const player = room?.players.find((candidate) => candidate.id === playerId);
    if (!room || !player || player.isConnected) return null;
    return this.leaveRoom(code, playerId);
  }

  getRoom(code: string) {
    const room = this.requireRoom(code);
    return this.publicRoom(room);
  }

  getInternalRoom(code: string) {
    return this.requireRoom(code);
  }

  findPlayerBySocket(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((candidate) => candidate.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }

  publicRoom(room: RoomState) {
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      gameSlug: room.gameSlug,
      ownerPlayerId: room.ownerPlayerId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      isPrivate: Boolean(room.passwordHash),
      settings: room.settings,
      phaseEndsAt: room.phaseEndsAt,
      roleValidation: validateRoleDistribution(room.players.length, room.settings.roles, room.settings.mode),
      players: room.players.map(
        ({ socketId: _socketId, reconnectToken: _token, guestId: _guestId, userId: _userId, ...player }) => player
      )
    };
  }

  private createPlayer(identity: SocketIdentity): RoomPlayerState {
    return {
      id: randomUUID(),
      userId: identity.userId,
      guestId: identity.guestId,
      nickname: identity.nickname.trim().slice(0, 24),
      isReady: false,
      isAlive: true,
      isConnected: true,
      socketId: identity.socketId,
      reconnectToken: createOpaqueToken(),
      joinedAt: Date.now()
    };
  }

  private totalRoles(settings: VampireVillageSettings) {
    return settings.roles.vampires + settings.roles.villagers + settings.roles.doctors;
  }

  private requireRoom(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Oda bulunamadı.", 404);
    return room;
  }

  private requireWaitingRoom(code: string) {
    const room = this.requireRoom(code);
    if (room.status !== "WAITING") throw new AppError("ROOM_LOCKED", "Oyun başladıktan sonra oda ayarları değiştirilemez.");
    return room;
  }

  private requirePlayer(room: RoomState, playerId: string) {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Oyuncu bulunamadı.", 404);
    return player;
  }

  private requireOwner(room: RoomState, playerId: string) {
    if (room.ownerPlayerId !== playerId) throw new AppError("OWNER_REQUIRED", "Bu işlem yalnızca oda sahibi tarafından yapılabilir.", 403);
  }
}
