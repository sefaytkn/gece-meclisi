import { randomInt } from "node:crypto";
import type { Role, RoleCounts } from "./VampireVillageTypes.js";

export function createRoleDeck(counts: RoleCounts): Role[] {
  return [
    ...Array<Role>(counts.vampires).fill("VAMPIRE"),
    ...Array<Role>(counts.villagers).fill("VILLAGER"),
    ...Array<Role>(counts.doctors).fill("DOCTOR")
  ];
}

export function secureShuffle<T>(items: readonly T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex]!, output[index]!];
  }
  return output;
}

export function assignRoles(playerIds: readonly string[], counts: RoleCounts): Map<string, Role> {
  const roles = secureShuffle(createRoleDeck(counts));
  if (roles.length !== playerIds.length) throw new Error("Rol sayısı oyuncu sayısıyla eşleşmiyor.");
  return new Map(playerIds.map((playerId, index) => [playerId, roles[index]!]));
}
