import type { InternalPlayer, VampirePhase } from "./VampireVillageTypes.js";
import { AppError } from "../../utils/AppError.js";

export type ChatChannel = "LOBBY" | "DAY" | "VAMPIRE" | "DEAD";

export function assertCanUseChat(player: InternalPlayer, phase: VampirePhase, channel: ChatChannel) {
  if (channel === "LOBBY" && phase !== "WAITING") {
    throw new AppError("CHAT_CHANNEL_CLOSED", "Lobi sohbeti oyun başlayınca kapanır.");
  }
  if (channel === "DAY" && (!player.isAlive || phase !== "DAY_DISCUSSION")) {
    throw new AppError("CHAT_FORBIDDEN", "Yalnızca hayattaki oyuncular gündüz sohbetine yazabilir.");
  }
  if (channel === "VAMPIRE" && (!player.isAlive || player.role !== "VAMPIRE" || phase !== "NIGHT")) {
    throw new AppError("CHAT_FORBIDDEN", "Vampir sohbetine erişemezsiniz.");
  }
  if (channel === "DEAD" && player.isAlive) {
    throw new AppError("CHAT_FORBIDDEN", "Ölü sohbeti yalnızca elenen oyunculara açıktır.");
  }
}
