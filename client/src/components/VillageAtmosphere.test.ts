import { describe, expect, it } from "vitest";
import { villageModeForGamePhase } from "./VillageAtmosphere";

describe("villageModeForGamePhase", () => {
  it("uses the night background while roles are revealed and during night actions", () => {
    expect(villageModeForGamePhase("ROLE_REVEAL")).toBe("NIGHT");
    expect(villageModeForGamePhase("NIGHT")).toBe("NIGHT");
  });

  it("uses the day background for waiting, discussion, voting and results", () => {
    expect(villageModeForGamePhase("WAITING")).toBe("DAY");
    expect(villageModeForGamePhase("DAY_DISCUSSION")).toBe("DAY");
    expect(villageModeForGamePhase("DAY_VOTING")).toBe("DAY");
    expect(villageModeForGamePhase("ROUND_RESULT")).toBe("DAY");
    expect(villageModeForGamePhase("FINISHED")).toBe("DAY");
  });
});
