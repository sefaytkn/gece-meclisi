import type { GameState } from "../types";

export type VillageAtmosphereMode = "DAY" | "SUNSET" | "NIGHT";

export function villageModeForGamePhase(phase: GameState["phase"]): VillageAtmosphereMode {
  return phase === "ROLE_REVEAL" || phase === "NIGHT" ? "NIGHT" : "DAY";
}

export function VillageAtmosphere({ mode }: { mode: VillageAtmosphereMode }) {
  return (
    <div className={`village-atmosphere village-atmosphere--${mode.toLowerCase()}`} aria-hidden="true">
      <div className="village-background-layer village-background-day" />
      <div className="village-background-layer village-background-night" />
      <div className="village-sunset-glow" />
      <div className="village-image-fog village-image-fog-one" />
      <div className="village-image-fog village-image-fog-two" />
      <div className="village-readable-shade" />
    </div>
  );
}
