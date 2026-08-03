import { z } from "zod";
import { randomInt } from "node:crypto";
import type { GameEngine } from "../core/GameEngine.js";
import type { EnginePlayer, PublicGameState, PublicRoundOutcome, Winner } from "../core/GameTypes.js";
import { AppError } from "../../utils/AppError.js";
import { assignRoles } from "./roleAssignment.js";
import { validateRoleDistribution } from "./validation.js";
import { checkWinner as calculateWinner } from "./winnerCheck.js";
import { resolveNight } from "./nightResolver.js";
import { resolveVotes, SKIP_VOTE_ID } from "./voteResolver.js";
import type {
  InternalPlayer,
  NightAction,
  Role,
  VampirePhase,
  VampireVillageSettings,
  VoteAction
} from "./VampireVillageTypes.js";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NIGHT_ACTION"), targetId: z.string().min(1) }),
  z.object({ type: z.literal("VOTE"), targetId: z.string().min(1) })
]);

const roleCopy = {
  VAMPIRE: {
    name: "Vampir",
    description: "Gece gölgelerin arasından bir kurban seç.",
    ability: "Diğer Vampirlerle birlikte gece saldırısı yaparsın.",
    goal: "Vampirlerin sayısını diğer yaşayanlara eşitle."
  },
  VILLAGER: {
    name: "Köylü",
    description: "Kasabayı gözlemle, çelişkileri yakala.",
    ability: "Gündüz tartışır ve şüphelendiğin kişiye oy verirsin.",
    goal: "Tüm Vampirleri ortaya çıkar."
  },
  DOCTOR: {
    name: "Doktor",
    description: "Kasaba uyurken bir hayatı koru.",
    ability: "Her gece yaşayan bir oyuncuyu saldırıdan korursun.",
    goal: "Kasabanın Vampirleri bulmasına yardım et."
  }
} satisfies Record<Role, { name: string; description: string; ability: string; goal: string }>;

export class VampireVillageEngine implements GameEngine {
  private phase: VampirePhase = "WAITING";
  private round = 0;
  private completedDayVotes = 0;
  private winner: Winner = null;
  private lastResult: string | null = null;
  private lastOutcome: PublicRoundOutcome | null = null;
  private readonly players = new Map<string, InternalPlayer>();
  private readonly nightActions = new Map<string, string>();
  private readonly villagerTasks = new Map<string, { targetId: string; expiresAt: number; completed: boolean }>();
  private readonly votes = new Map<string, string>();
  private lastVoteTally: { targetId: string; count: number; voterIds: string[] }[] = [];

  constructor(
    private readonly initialPlayers: EnginePlayer[],
    public readonly settings: VampireVillageSettings
  ) {}

  start() {
    if (this.phase !== "WAITING") throw new AppError("GAME_ALREADY_STARTED", "Oyun zaten başladı.");
    const validation = validateRoleDistribution(this.initialPlayers.length, this.settings.roles, this.settings.mode);
    if (!validation.valid) {
      const error = validation.errors[0]!;
      throw new AppError(error.code, error.message);
    }
    const assignments = assignRoles(this.initialPlayers.map((player) => player.id), this.settings.roles);
    this.initialPlayers.forEach((player) => {
      this.players.set(player.id, {
        ...player,
        role: assignments.get(player.id)!,
        isAlive: true,
        connected: true,
        eliminationRound: null,
        deathCause: null,
        previousProtectionTarget: null,
        selfProtectionUsed: false
      });
    });
    this.phase = "ROLE_REVEAL";
  }

  handleAction(playerId: string, rawAction: unknown) {
    const action = actionSchema.parse(rawAction) as NightAction | VoteAction;
    const player = this.requireAlivePlayer(playerId);
    if (action.type === "NIGHT_ACTION") {
      const target = this.requireAlivePlayer(action.targetId);
      this.handleNightAction(player, target);
    } else {
      if (action.targetId !== SKIP_VOTE_ID) this.requireAlivePlayer(action.targetId);
      this.handleVote(player, action.targetId);
    }
  }

  private handleNightAction(player: InternalPlayer, target: InternalPlayer) {
    if (this.phase !== "NIGHT") throw new AppError("INVALID_PHASE", "Gece eylemleri yalnızca gece aşamasında yapılabilir.");
    if (player.role === "VILLAGER") {
      const task = this.villagerTasks.get(player.id);
      if (!task) throw new AppError("VILLAGER_TASK_NOT_FOUND", "Bu gece için görev bulunamadı.");
      if (Date.now() >= task.expiresAt) throw new AppError("VILLAGER_TASK_EXPIRED", "Gece görevinin süresi doldu.");
      if (task.completed) throw new AppError("ACTION_ALREADY_SUBMITTED", "Bu gece görevini zaten tamamladınız.");
      if (target.id !== task.targetId) throw new AppError("WRONG_VILLAGER_TARGET", "Hedefin bu oyuncu değil.");
      task.completed = true;
      return;
    }
    if (this.nightActions.has(player.id)) throw new AppError("ACTION_ALREADY_SUBMITTED", "Bu gece eylemini zaten kullandınız.");
    if (player.role === "VAMPIRE" && target.role === "VAMPIRE") {
      throw new AppError("INVALID_TARGET", "Vampirler başka bir Vampiri hedefleyemez.");
    }
    if (player.role === "DOCTOR") {
      if (!this.settings.doctorCanSelfProtect && player.id === target.id) {
        throw new AppError("SELF_PROTECT_DISABLED", "Bu odada Doktor kendisini koruyamaz.");
      }
      if (player.id === target.id && player.selfProtectionUsed) {
        throw new AppError("SELF_PROTECTION_ALREADY_USED", "Doktor kendisini oyun boyunca yalnızca bir kez koruyabilir.");
      }
      if (!this.settings.doctorCanRepeatTarget && player.previousProtectionTarget === target.id) {
        throw new AppError("REPEAT_PROTECTION_DISABLED", "Doktor aynı oyuncuyu art arda koruyamaz.");
      }
    }
    this.nightActions.set(player.id, target.id);
    if (player.role === "DOCTOR" && player.id === target.id) player.selfProtectionUsed = true;
  }

  private handleVote(player: InternalPlayer, targetId: string) {
    if (this.phase !== "DAY_VOTING") throw new AppError("INVALID_PHASE", "Oy yalnızca gündüz oylamasında kullanılabilir.");
    if (!this.settings.canSelfVote && player.id === targetId) {
      throw new AppError("SELF_VOTE_DISABLED", "Bu odada kendinize oy veremezsiniz.");
    }
    if (this.votes.has(player.id) && !this.settings.canChangeVote) {
      throw new AppError("VOTE_ALREADY_CAST", "Bu tur oyunuzu zaten kullandınız.");
    }
    this.votes.set(player.id, targetId);
  }

  advancePhase(): VampirePhase {
    if (this.phase === "ROLE_REVEAL") {
      this.round = 1;
      this.beginNight();
      this.lastResult = "Gece çöktü. Kasaba sessizliğe büründü.";
    } else if (this.phase === "NIGHT") {
      this.resolveCurrentNight();
      this.finishOr("DAY_DISCUSSION");
    } else if (this.phase === "DAY_DISCUSSION") {
      this.phase = "DAY_VOTING";
      this.votes.clear();
      this.lastVoteTally = [];
      this.lastOutcome = null;
      this.lastResult = "Kasaba kararını vermek için oylamaya geçti.";
    } else if (this.phase === "DAY_VOTING") {
      const resolution = resolveVotes(this.votes);
      const tally = new Map<string, string[]>();
      this.votes.forEach((targetId, voterId) => {
        const voters = tally.get(targetId) ?? [];
        voters.push(voterId);
        tally.set(targetId, voters);
      });
      this.lastVoteTally = [...tally].map(([targetId, voterIds]) => ({
        targetId,
        count: voterIds.length,
        voterIds: this.settings.voteVisibility === "PUBLIC" ? voterIds : []
      }));
      if (resolution.eliminatedId) {
        const eliminated = this.players.get(resolution.eliminatedId)!;
        eliminated.isAlive = false;
        eliminated.eliminationRound = this.round;
        eliminated.deathCause = "VOTE";
        this.lastResult = `${eliminated.nickname} kasabanın kararıyla elendi.`;
        this.lastOutcome = {
          id: `${this.round}:VOTE:${eliminated.id}`,
          type: "VOTE_ELIMINATION",
          round: this.round,
          playerId: eliminated.id,
          nickname: eliminated.nickname
        };
      } else if (resolution.tiedIds.length > 1) {
        this.lastResult = "Oylar eşit çıktı. Kimse elenmedi; kasaba bir sonraki geceye hazırlanıyor.";
        this.lastOutcome = { id: `${this.round}:VOTE:SAFE`, type: "VOTE_SAFE", round: this.round };
      } else {
        this.lastResult = "Oylama sonucunda kimse elenmedi.";
        this.lastOutcome = { id: `${this.round}:VOTE:SAFE`, type: "VOTE_SAFE", round: this.round };
      }
      this.completedDayVotes += 1;
      this.finishOr("ROUND_RESULT");
    } else if (this.phase === "ROUND_RESULT") {
      this.round += 1;
      this.nightActions.clear();
      this.votes.clear();
      this.lastOutcome = null;
      if (this.wouldNextNightCreateVampireParity()) {
        this.phase = "DAY_DISCUSSION";
        this.lastResult = "Vampirler çoğunluğa çok yaklaştı. Kasaba gece olmadan yeniden tartışmaya geçti.";
      } else {
        this.beginNight();
        this.lastResult = `${this.round}. gece başladı.`;
      }
    }
    return this.phase;
  }

  private resolveCurrentNight() {
    const resolution = resolveNight([...this.players.values()], this.nightActions, this.settings.vampireTieRule);
    for (const player of this.players.values()) {
      if (player.role === "DOCTOR" && this.nightActions.has(player.id)) {
        player.previousProtectionTarget = this.nightActions.get(player.id)!;
      }
    }
    if (resolution.eliminatedId) {
      const eliminated = this.players.get(resolution.eliminatedId)!;
      eliminated.isAlive = false;
      eliminated.eliminationRound = this.round;
      eliminated.deathCause = "VAMPIRE";
      this.lastResult = `Gün doğduğunda ${eliminated.nickname} hayatta değildi.`;
      this.lastOutcome = {
        id: `${this.round}:NIGHT:${eliminated.id}`,
        type: "NIGHT_ELIMINATION",
        round: this.round,
        playerId: eliminated.id,
        nickname: eliminated.nickname
      };
    } else if (resolution.attackedId) {
      this.lastResult = "Gece bir saldırı oldu, fakat kimse ölmedi.";
      this.lastOutcome = { id: `${this.round}:NIGHT:SAFE`, type: "NIGHT_SAFE", round: this.round };
    } else {
      this.lastResult = "Gece sakince geçti. Kimse ölmedi.";
      this.lastOutcome = { id: `${this.round}:NIGHT:SAFE`, type: "NIGHT_SAFE", round: this.round };
    }
    this.nightActions.clear();
  }

  private finishOr(next: VampirePhase) {
    const calculatedWinner = this.checkWinner();
    const winner = next === "DAY_DISCUSSION" && calculatedWinner === "VAMPIRES" ? null : calculatedWinner;
    if (winner) {
      this.winner = winner;
      this.phase = "FINISHED";
      this.lastResult = winner === "VILLAGE" ? "Kasaba bütün Vampirleri buldu!" : "Vampirler kasabayı ele geçirdi!";
    } else {
      this.phase = next;
    }
  }

  checkWinner(): Winner {
    return calculateWinner([...this.players.values()], this.completedDayVotes);
  }

  private wouldNextNightCreateVampireParity() {
    const alive = [...this.players.values()].filter((player) => player.isAlive);
    const vampires = alive.filter((player) => player.role === "VAMPIRE").length;
    const others = alive.length - vampires;
    return vampires > 0 && others === vampires + 1;
  }

  private beginNight() {
    this.phase = "NIGHT";
    this.villagerTasks.clear();
    const expiresAt = Date.now() + 10_000;
    const alive = [...this.players.values()].filter((player) => player.isAlive);
    alive
      .filter((player) => player.role === "VILLAGER")
      .forEach((villager) => {
        const candidates = alive.filter((candidate) => candidate.id !== villager.id);
        if (candidates.length === 0) return;
        const target = candidates[randomInt(candidates.length)]!;
        this.villagerTasks.set(villager.id, { targetId: target.id, expiresAt, completed: false });
      });
  }

  haveAllRequiredNightActions() {
    if (this.phase !== "NIGHT") return false;
    const activePlayers = [...this.players.values()].filter((player) => player.isAlive && player.connected);
    const now = Date.now();
    return activePlayers.length > 0 && activePlayers.every((player) => {
      if (player.role !== "VILLAGER") return this.nightActions.has(player.id);
      const task = this.villagerTasks.get(player.id);
      return !task || task.completed || now >= task.expiresAt;
    });
  }

  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      if (this.phase !== "WAITING" && this.phase !== "FINISHED") {
        player.isAlive = false;
        player.eliminationRound = this.round;
        player.deathCause = "DISCONNECTED";
      }
    }
  }

  reconnectPlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (player) player.connected = true;
  }

  setConnected(playerId: string, connected: boolean) {
    const player = this.players.get(playerId);
    if (player) player.connected = connected;
  }

  getInternalPlayer(playerId: string) {
    return this.players.get(playerId) ?? null;
  }

  getPhase() {
    return this.phase;
  }

  getPublicState(): PublicGameState {
    return {
      phase: this.phase,
      round: this.round,
      winner: this.winner,
      lastResult: this.lastResult,
      lastOutcome: this.lastOutcome,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        nickname: player.nickname,
        isAlive: player.isAlive,
        eliminationRound: player.eliminationRound,
        connected: player.connected
      })),
      votesCast: this.votes.size,
      votedPlayerIds: [...this.votes.keys()],
      publicVotes:
        this.settings.voteVisibility === "PUBLIC"
          ? [...this.votes].map(([voterId, targetId]) => ({ voterId, targetId }))
          : [],
      lastVoteTally: this.lastVoteTally
    };
  }

  getPrivateState(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Oyuncu bulunamadı.", 404);
    return {
      playerId: player.id,
      role: player.role,
      roleInfo: roleCopy[player.role],
      isAlive: player.isAlive,
      submittedNightAction: this.nightActions.has(player.id),
      doctorSelfProtectionUsed: player.role === "DOCTOR" ? player.selfProtectionUsed : false,
      currentVote: this.votes.get(player.id) ?? null,
      deathCause: player.deathCause,
      vampireAllies:
        player.role === "VAMPIRE"
          ? [...this.players.values()]
              .filter((candidate) => candidate.role === "VAMPIRE" && candidate.id !== player.id)
              .map((candidate) => ({
                playerId: candidate.id,
                nickname: candidate.nickname,
                isAlive: candidate.isAlive
              }))
          : [],
      vampireNightChoices:
        player.role === "VAMPIRE" && this.phase === "NIGHT"
          ? [...this.players.values()]
              .filter((candidate) => candidate.role === "VAMPIRE" && candidate.isAlive)
              .flatMap((candidate) => {
                const targetId = this.nightActions.get(candidate.id);
                return targetId
                  ? [{ playerId: candidate.id, nickname: candidate.nickname, targetId }]
                  : [];
              })
          : [],
      villagerTask:
        player.role === "VILLAGER" && this.phase === "NIGHT"
          ? (() => {
              const task = this.villagerTasks.get(player.id);
              const target = task ? this.players.get(task.targetId) : null;
              return task && target
                ? {
                    targetId: task.targetId,
                    targetNickname: target.nickname,
                    expiresAt: task.expiresAt,
                    completed: task.completed || Date.now() >= task.expiresAt
                  }
                : null;
            })()
          : null,
      revealedRoles:
        this.phase === "FINISHED" || (!player.isAlive && this.settings.deadCanSeeRoles)
          ? [...this.players.values()].map((candidate) => ({
              playerId: candidate.id,
              nickname: candidate.nickname,
              role: candidate.role,
              isAlive: candidate.isAlive
            }))
          : []
    };
  }

  private requireAlivePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) throw new AppError("PLAYER_NOT_FOUND", "Oyuncu bulunamadı.", 404);
    if (!player.isAlive) throw new AppError("PLAYER_IS_DEAD", "Elenen oyuncular bu işlemi yapamaz.");
    return player;
  }
}
