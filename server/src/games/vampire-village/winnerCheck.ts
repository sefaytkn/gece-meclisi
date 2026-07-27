import type { InternalPlayer } from "./VampireVillageTypes.js";
import type { Winner } from "../core/GameTypes.js";

export function checkWinner(players: readonly InternalPlayer[], completedDayVotes: number): Winner {
  const alive = players.filter((player) => player.isAlive);
  const vampires = alive.filter((player) => player.role === "VAMPIRE").length;
  const others = alive.length - vampires;
  if (completedDayVotes === 0) return null;
  if (vampires === 0) return "VILLAGE";
  if (vampires >= others) return "VAMPIRES";
  return null;
}
