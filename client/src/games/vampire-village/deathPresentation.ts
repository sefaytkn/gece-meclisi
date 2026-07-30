import type { PlayerElimination } from "../../types";

export function shouldShowPersonalDeathEffect(
  elimination: PlayerElimination,
  currentPlayerId: string | undefined
) {
  return Boolean(currentPlayerId && elimination.playerId === currentPlayerId);
}
