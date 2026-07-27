import type { PublicGameState, Winner } from "./GameTypes.js";

export interface GameEngine {
  start(): void;
  handleAction(playerId: string, action: unknown): void;
  removePlayer(playerId: string): void;
  reconnectPlayer(playerId: string): void;
  checkWinner(): Winner;
  getPublicState(): PublicGameState;
  getPrivateState(playerId: string): unknown;
}
