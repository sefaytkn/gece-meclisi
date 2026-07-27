import type { EnginePlayer } from "./GameTypes.js";
import type { GameEngine } from "./GameEngine.js";
import { VampireVillageEngine } from "../vampire-village/VampireVillageEngine.js";
import type { VampireVillageSettings } from "../vampire-village/VampireVillageTypes.js";
import { AppError } from "../../utils/AppError.js";

type EngineFactory = (players: EnginePlayer[], settings: VampireVillageSettings) => GameEngine;

export class GameRegistry {
  private readonly factories = new Map<string, EngineFactory>();

  constructor() {
    this.register("vampire-village", (players, settings) => new VampireVillageEngine(players, settings));
  }

  register(slug: string, factory: EngineFactory) {
    this.factories.set(slug, factory);
  }

  create(slug: string, players: EnginePlayer[], settings: VampireVillageSettings) {
    const factory = this.factories.get(slug);
    if (!factory) throw new AppError("GAME_NOT_FOUND", "Bu oyun henüz desteklenmiyor.", 404);
    return factory(players, settings);
  }
}
