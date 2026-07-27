import { randomInt } from "node:crypto";
import type { InternalPlayer } from "./VampireVillageTypes.js";

export interface NightResolution {
  attackedId: string | null;
  protectedIds: string[];
  eliminatedId: string | null;
}

function mostVoted(votes: string[], tieRule: "NO_KILL" | "RANDOM"): string | null {
  if (votes.length === 0) return null;
  const totals = new Map<string, number>();
  votes.forEach((target) => totals.set(target, (totals.get(target) ?? 0) + 1));
  const max = Math.max(...totals.values());
  const leaders = [...totals.entries()].filter(([, count]) => count === max).map(([id]) => id);
  if (leaders.length === 1) return leaders[0]!;
  return tieRule === "RANDOM" ? leaders[randomInt(0, leaders.length)]! : null;
}

export function resolveNight(
  players: readonly InternalPlayer[],
  actions: ReadonlyMap<string, string>,
  tieRule: "NO_KILL" | "RANDOM"
): NightResolution {
  const vampireVotes = players
    .filter((player) => player.isAlive && player.role === "VAMPIRE")
    .map((player) => actions.get(player.id))
    .filter((id): id is string => Boolean(id));
  const protectedIds = players
    .filter((player) => player.isAlive && player.role === "DOCTOR")
    .map((player) => actions.get(player.id))
    .filter((id): id is string => Boolean(id));
  const attackedId = mostVoted(vampireVotes, tieRule);
  const eliminatedId = attackedId && !protectedIds.includes(attackedId) ? attackedId : null;
  return { attackedId, protectedIds, eliminatedId };
}
