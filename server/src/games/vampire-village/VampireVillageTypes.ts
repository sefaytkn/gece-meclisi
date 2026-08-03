export type Role = "VAMPIRE" | "VILLAGER" | "DOCTOR";
export type GameMode = "BALANCED" | "FREE";
export type VoteVisibility = "SECRET" | "PUBLIC";
export type DeathCause = "VAMPIRE" | "VOTE" | "DISCONNECTED";
export type VampirePhase =
  | "WAITING"
  | "ROLE_REVEAL"
  | "NIGHT"
  | "DAY_DISCUSSION"
  | "DAY_VOTING"
  | "ROUND_RESULT"
  | "FINISHED";

export interface RoleCounts {
  vampires: number;
  villagers: number;
  doctors: number;
}

export interface VampireVillageSettings {
  mode: GameMode;
  roles: RoleCounts;
  discussionSeconds: number;
  nightSeconds: number;
  votingSeconds: number;
  doctorCanSelfProtect: boolean;
  doctorCanRepeatTarget: boolean;
  vampireTieRule: "NO_KILL" | "RANDOM";
  votingTieRule: "NO_ELIMINATION" | "REVOTE" | "RANDOM";
  canChangeVote: boolean;
  canSelfVote: boolean;
  voteVisibility: VoteVisibility;
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

export interface InternalPlayer {
  id: string;
  nickname: string;
  role: Role;
  isAlive: boolean;
  connected: boolean;
  eliminationRound: number | null;
  deathCause: DeathCause | null;
  previousProtectionTarget: string | null;
  selfProtectionUsed: boolean;
}

export interface NightAction {
  type: "NIGHT_ACTION";
  targetId: string;
}

export interface VoteAction {
  type: "VOTE";
  targetId: string;
}
