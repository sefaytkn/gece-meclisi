export type GameMode = "BALANCED" | "FREE";
export type Role = "VAMPIRE" | "VILLAGER" | "DOCTOR";

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface RoomPlayer {
  id: string;
  nickname: string;
  isReady: boolean;
  isAlive: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomSettings {
  mode: GameMode;
  roles: { vampires: number; villagers: number; doctors: number };
  discussionSeconds: number;
  nightSeconds: number;
  votingSeconds: number;
  doctorCanSelfProtect: boolean;
  doctorCanRepeatTarget: boolean;
  vampireTieRule: "NO_KILL" | "RANDOM";
  votingTieRule: "NO_ELIMINATION" | "REVOTE" | "RANDOM";
  canChangeVote: boolean;
  canSelfVote: boolean;
  voteVisibility: "SECRET" | "PUBLIC";
  deadCanSeeRoles: boolean;
}

export interface RoleValidation {
  valid: boolean;
  balanced: boolean;
  selectedTotal: number;
  difference: number;
  errors: { code: string; message: string }[];
  warnings: string[];
}

export interface Room {
  id: string;
  code: string;
  name: string;
  gameSlug: string;
  ownerPlayerId: string;
  status: "WAITING" | "STARTING" | "PLAYING" | "FINISHED";
  maxPlayers: number;
  isPrivate: boolean;
  settings: RoomSettings;
  phaseEndsAt: number | null;
  roleValidation: RoleValidation;
  players: RoomPlayer[];
}

export interface GamePlayer {
  id: string;
  nickname: string;
  isAlive: boolean;
  connected?: boolean;
  eliminationRound: number | null;
}

export interface GameState {
  phase: "WAITING" | "ROLE_REVEAL" | "NIGHT" | "DAY_DISCUSSION" | "DAY_VOTING" | "ROUND_RESULT" | "FINISHED";
  round: number;
  winner: "VILLAGE" | "VAMPIRES" | null;
  players: GamePlayer[];
  lastResult: string | null;
  phaseEndsAt: number | null;
  serverNow?: number;
  votesCast: number;
  publicVotes: { voterId: string; targetId: string }[];
  lastVoteTally: { targetId: string; count: number; voterIds: string[] }[];
}

export interface PrivateState {
  playerId: string;
  role: Role;
  roleInfo: { name: string; description: string; ability: string; goal: string };
  isAlive: boolean;
  submittedNightAction: boolean;
  currentVote: string | null;
  deathCause: "VAMPIRE" | "VOTE" | "DISCONNECTED" | null;
  revealedRoles: { playerId: string; nickname: string; role: Role; isAlive: boolean }[];
}

export interface ChatMessage {
  id: string;
  username: string;
  playerId?: string;
  sentAt: string;
  type: "LOBBY" | "DAY" | "VAMPIRE" | "DEAD" | "SYSTEM";
  isSystem: boolean;
  message: string;
}

export type Ack<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
