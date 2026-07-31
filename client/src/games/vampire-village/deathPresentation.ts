import type { PlayerElimination } from "../../types";

export type VampireKillVariant = "BACKSTAB" | "SHADOW_BITE" | "DASH_SLASH";

const vampireKillVariants: VampireKillVariant[] = ["BACKSTAB", "SHADOW_BITE", "DASH_SLASH"];

export function vampireKillVariantFor(elimination: Pick<PlayerElimination, "id" | "round">): VampireKillVariant {
  const seed = `${elimination.id}:${elimination.round}`;
  const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return vampireKillVariants[hash % vampireKillVariants.length]!;
}

export function shouldShowPersonalDeathEffect(
  elimination: PlayerElimination,
  currentPlayerId: string | undefined
) {
  return Boolean(currentPlayerId && elimination.playerId === currentPlayerId);
}
