import { describe, expect, it } from "vitest";
import type { PlayerElimination } from "../../types";
import { shouldShowPersonalDeathEffect } from "./deathPresentation";

const elimination: PlayerElimination = {
  id: "event-1",
  playerId: "player-2",
  nickname: "Sefa",
  cause: "VAMPIRE",
  round: 1
};

describe("kişisel ölüm animasyonu", () => {
  it("yalnızca elenen oyuncunun ekranında gösterilir", () => {
    expect(shouldShowPersonalDeathEffect(elimination, "player-2")).toBe(true);
    expect(shouldShowPersonalDeathEffect(elimination, "player-1")).toBe(false);
    expect(shouldShowPersonalDeathEffect(elimination, undefined)).toBe(false);
  });
});
