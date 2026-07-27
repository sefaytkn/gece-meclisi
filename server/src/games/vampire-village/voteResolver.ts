import { randomInt } from "node:crypto";

export const SKIP_VOTE_ID = "__SKIP__";

export interface VoteResolution {
  eliminatedId: string | null;
  tiedIds: string[];
  requiresRevote: boolean;
}

export function resolveVotes(
  votes: ReadonlyMap<string, string>,
  tieRule: "NO_ELIMINATION" | "REVOTE" | "RANDOM"
): VoteResolution {
  if (votes.size === 0) return { eliminatedId: null, tiedIds: [], requiresRevote: false };
  const totals = new Map<string, number>();
  votes.forEach((target) => totals.set(target, (totals.get(target) ?? 0) + 1));
  const maximum = Math.max(...totals.values());
  const tiedIds = [...totals.entries()].filter(([, count]) => count === maximum).map(([id]) => id);
  if (tiedIds.includes(SKIP_VOTE_ID)) {
    return { eliminatedId: null, tiedIds, requiresRevote: false };
  }
  if (tiedIds.length === 1) return { eliminatedId: tiedIds[0]!, tiedIds: [], requiresRevote: false };
  if (tieRule === "RANDOM") {
    return { eliminatedId: tiedIds[randomInt(0, tiedIds.length)]!, tiedIds, requiresRevote: false };
  }
  return { eliminatedId: null, tiedIds, requiresRevote: tieRule === "REVOTE" };
}
