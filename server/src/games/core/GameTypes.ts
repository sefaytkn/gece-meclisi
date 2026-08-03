export interface EnginePlayer {
  id: string;
  nickname: string;
}

export interface PublicPlayer extends EnginePlayer {
  isAlive: boolean;
  eliminationRound: number | null;
}

export type Winner = "VILLAGE" | "VAMPIRES" | null;

export interface PublicRoundOutcome {
  id: string;
  type: "NIGHT_ELIMINATION" | "VOTE_ELIMINATION" | "NIGHT_SAFE" | "VOTE_SAFE";
  round: number;
  playerId?: string;
  nickname?: string;
}

export interface PublicGameState {
  phase: string;
  round: number;
  winner: Winner;
  players: PublicPlayer[];
  lastResult: string | null;
  lastOutcome: PublicRoundOutcome | null;
  votesCast: number;
  votedPlayerIds: string[];
  publicVotes: { voterId: string; targetId: string }[];
  lastVoteTally: { targetId: string; count: number; voterIds: string[] }[];
}
