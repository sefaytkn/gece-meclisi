export interface EnginePlayer {
  id: string;
  nickname: string;
}

export interface PublicPlayer extends EnginePlayer {
  isAlive: boolean;
  eliminationRound: number | null;
}

export type Winner = "VILLAGE" | "VAMPIRES" | null;

export interface PublicGameState {
  phase: string;
  round: number;
  winner: Winner;
  players: PublicPlayer[];
  lastResult: string | null;
  votesCast: number;
  publicVotes: { voterId: string; targetId: string }[];
  lastVoteTally: { targetId: string; count: number; voterIds: string[] }[];
}
