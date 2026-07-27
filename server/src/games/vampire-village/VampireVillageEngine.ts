import { z } from "zod";
import type { GameEngine } from "../core/GameEngine.js";
import type { EnginePlayer, PublicGameState, Winner } from "../core/GameTypes.js";
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
  private readonly players = new Map<string, InternalPlayer>();
  private readonly nightActions = new Map<string, string>();
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
        previousProtectionTarget: null
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
    if (player.role === "VILLAGER") throw new AppError("ROLE_HAS_NO_NIGHT_ACTION", "Köylünün gece eylemi yoktur.");
    if (this.nightActions.has(player.id)) throw new AppError("ACTION_ALREADY_SUBMITTED", "Bu gece eylemini zaten kullandınız.");
    if (player.role === "VAMPIRE" && target.role === "VAMPIRE") {
      throw new AppError("INVALID_TARGET", "Vampirler başka bir Vampiri hedefleyemez.");
    }
    if (player.role === "DOCTOR") {
      if (!this.settings.doctorCanSelfProtect && player.id === target.id) {
        throw new AppError("SELF_PROTECT_DISABLED", "Bu odada Doktor kendisini koruyamaz.");
      }
      if (!this.settings.doctorCanRepeatTarget && player.previousProtectionTarget === target.id) {
        throw new AppError("REPEAT_PROTECTION_DISABLED", "Doktor aynı oyuncuyu art arda koruyamaz.");
      }
    }
    this.nightActions.set(player.id, target.id);
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
      this.phase = "NIGHT";
      this.lastResult = "Gece çöktü. Kasaba sessizliğe büründü.";
    } else if (this.phase === "NIGHT") {
      this.resolveCurrentNight();
      this.finishOr("DAY_DISCUSSION");
    } else if (this.phase === "DAY_DISCUSSION") {
      this.phase = "DAY_VOTING";
      this.votes.clear();
      this.lastVoteTally = [];
      this.lastResult = "Kasaba kararını vermek için oylamaya geçti.";
    } else if (this.phase === "DAY_VOTING") {
      const resolution = resolveVotes(this.votes, this.settings.votingTieRule);
      if (resolution.requiresRevote) {
        this.votes.clear();
        this.lastVoteTally = [];
        this.lastResult = "Oylar eşit çıktı. Oylama tekrarlanıyor.";
        return this.phase;
      }
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
      } else {
        this.lastResult = "Oylama sonucunda kimse elenmedi.";
      }
      this.completedDayVotes += 1;
      this.finishOr("ROUND_RESULT");
    } else if (this.phase === "ROUND_RESULT") {
      this.round += 1;
      this.nightActions.clear();
      this.votes.clear();
      this.phase = "NIGHT";
      this.lastResult = `${this.round}. gece başladı.`;
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
    } else if (resolution.attackedId) {
      this.lastResult = "Gece bir saldırı oldu, fakat kimse ölmedi.";
    } else {
      this.lastResult = "Gece sakince geçti. Kimse ölmedi.";
    }
    this.nightActions.clear();
  }

  private finishOr(next: VampirePhase) {
    const winner = this.checkWinner();
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
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        nickname: player.nickname,
        isAlive: player.isAlive,
        eliminationRound: player.eliminationRound,
        connected: player.connected
      })),
      votesCast: this.votes.size,
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
      currentVote: this.votes.get(player.id) ?? null,
      deathCause: player.deathCause,
      revealedRoles:
        !player.isAlive && this.settings.deadCanSeeRoles
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
