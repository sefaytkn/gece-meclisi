import { describe, expect, it } from "vitest";
import { getLocalPhaseEndsAt } from "./useCountdown";

describe("getLocalPhaseEndsAt", () => {
  it("uses the server clock delta when the player device clock differs", () => {
    const clientNow = 1_000_000;
    const serverNow = 2_000_000;
    const serverEndsAt = 2_020_000;

    expect(getLocalPhaseEndsAt(serverEndsAt, serverNow, clientNow)).toBe(1_020_000);
  });

  it("never creates a negative remaining duration", () => {
    expect(getLocalPhaseEndsAt(1_900_000, 2_000_000, 1_000_000)).toBe(1_000_000);
  });
});
