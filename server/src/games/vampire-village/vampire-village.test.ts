import { describe, expect, it } from "vitest";
import { validateRoleDistribution } from "./validation.js";
import { assignRoles, createRoleDeck } from "./roleAssignment.js";
import { VampireVillageEngine } from "./VampireVillageEngine.js";
import { checkWinner } from "./winnerCheck.js";
import { assertCanUseChat } from "./chatPermissions.js";
import { SKIP_VOTE_ID } from "./voteResolver.js";
import type { EnginePlayer } from "../core/GameTypes.js";
import type { InternalPlayer, VampireVillageSettings } from "./VampireVillageTypes.js";

const players: EnginePlayer[] = Array.from({ length: 5 }, (_, index) => ({
  id: `player-${index + 1}`,
  nickname: `Oyuncu ${index + 1}`
}));

const settings = (overrides: Partial<VampireVillageSettings> = {}): VampireVillageSettings => ({
  mode: "BALANCED",
  roles: { vampires: 1, villagers: 3, doctors: 1 },
  discussionSeconds: 60,
  nightSeconds: 30,
  votingSeconds: 30,
  doctorCanSelfProtect: true,
  doctorCanRepeatTarget: false,
  vampireTieRule: "NO_KILL",
  votingTieRule: "NO_ELIMINATION",
  canChangeVote: true,
  canSelfVote: false,
  voteVisibility: "SECRET",
  deadCanSeeRoles: true,
  ...overrides
});

function startedEngine() {
  const engine = new VampireVillageEngine(players, settings());
  engine.start();
  engine.advancePhase();
  return engine;
}

describe("rol doğrulama", () => {
  it("rol toplamını oyuncu sayısıyla eşleştirir", () => {
    expect(validateRoleDistribution(5, { vampires: 1, villagers: 3, doctors: 1 }, "BALANCED").valid).toBe(true);
    expect(validateRoleDistribution(5, { vampires: 1, villagers: 2, doctors: 1 }, "BALANCED").errors[0]?.code).toBe(
      "INVALID_ROLE_TOTAL"
    );
  });

  it("negatif ve ondalıklı rol sayılarını engeller", () => {
    const negative = validateRoleDistribution(4, { vampires: 1, villagers: 4, doctors: -1 }, "BALANCED");
    const decimal = validateRoleDistribution(4, { vampires: 1.5, villagers: 2.5, doctors: 0 }, "BALANCED");
    expect(negative.errors.some((error) => error.code === "NEGATIVE_ROLE_COUNT")).toBe(true);
    expect(decimal.errors.some((error) => error.code === "ROLE_COUNT_NOT_INTEGER")).toBe(true);
  });

  it("eksik/fazla toplamı ve taraflardan birinin yokluğunu engeller", () => {
    expect(validateRoleDistribution(4, { vampires: 1, villagers: 2, doctors: 0 }, "FREE").errors.some((error) => error.code === "INVALID_ROLE_TOTAL")).toBe(true);
    expect(validateRoleDistribution(4, { vampires: 1, villagers: 4, doctors: 0 }, "FREE").errors.some((error) => error.code === "INVALID_ROLE_TOTAL")).toBe(true);
    expect(validateRoleDistribution(4, { vampires: 0, villagers: 4, doctors: 0 }, "FREE").errors.some((error) => error.code === "VAMPIRE_REQUIRED")).toBe(true);
    expect(validateRoleDistribution(4, { vampires: 4, villagers: 0, doctors: 0 }, "FREE").errors.some((error) => error.code === "NON_VAMPIRE_REQUIRED")).toBe(true);
  });

  it("dengeli modu engeller, serbest modda uyarı üretir", () => {
    expect(validateRoleDistribution(4, { vampires: 2, villagers: 2, doctors: 0 }, "BALANCED").valid).toBe(false);
    const free = validateRoleDistribution(4, { vampires: 2, villagers: 2, doctors: 0 }, "FREE");
    expect(free.valid).toBe(true);
    expect(free.warnings).toHaveLength(1);
  });
});

describe("rol dağıtımı", () => {
  it("rolleri istenen sayıda oluşturur", () => {
    const deck = createRoleDeck({ vampires: 2, villagers: 4, doctors: 1 });
    expect(deck.filter((role) => role === "VAMPIRE")).toHaveLength(2);
    expect(deck.filter((role) => role === "VILLAGER")).toHaveLength(4);
    expect(deck.filter((role) => role === "DOCTOR")).toHaveLength(1);
  });

  it("kriptografik karıştırma sonucunda tek bir sabit sıra üretmez", () => {
    const ids = players.map((player) => player.id);
    const arrangements = new Set(
      Array.from({ length: 16 }, () => [...assignRoles(ids, settings().roles).values()].join(","))
    );
    expect(arrangements.size).toBeGreaterThan(1);
  });

  it("genel state içinde rolleri sızdırmaz ve oyuncuya yalnızca kendi rolünü verir", () => {
    const engine = startedEngine();
    const publicState = engine.getPublicState();
    expect(publicState.players.every((player) => !("role" in player))).toBe(true);
    const privateState = engine.getPrivateState(players[0]!.id) as Record<string, unknown>;
    expect(privateState.role).toBeTruthy();
    expect(JSON.stringify(privateState)).not.toContain(players[1]!.id);
  });
});

describe("gece, oy ve sohbet kuralları", () => {
  it("Doktor Vampir hedefini koruduğunda ölümü engeller", () => {
    const engine = startedEngine();
    const internal = players.map((player) => engine.getInternalPlayer(player.id)!);
    const vampire = internal.find((player) => player.role === "VAMPIRE")!;
    const doctor = internal.find((player) => player.role === "DOCTOR")!;
    const target = internal.find((player) => player.role === "VILLAGER")!;
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: target.id });
    engine.handleAction(doctor.id, { type: "NIGHT_ACTION", targetId: target.id });
    engine.advancePhase();
    expect(engine.getInternalPlayer(target.id)?.isAlive).toBe(true);
  });

  it("Doktor korumadığında Vampir hedefini eler", () => {
    const engine = startedEngine();
    const internal = players.map((player) => engine.getInternalPlayer(player.id)!);
    const vampire = internal.find((player) => player.role === "VAMPIRE")!;
    const doctor = internal.find((player) => player.role === "DOCTOR")!;
    const target = internal.find((player) => player.role === "VILLAGER")!;
    const other = internal.find((player) => player.id !== target.id && player.id !== doctor.id && player.role !== "VAMPIRE")!;
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: target.id });
    engine.handleAction(doctor.id, { type: "NIGHT_ACTION", targetId: other.id });
    engine.advancePhase();
    expect(engine.getInternalPlayer(target.id)?.isAlive).toBe(false);
    expect(engine.getPrivateState(target.id)).toMatchObject({ deathCause: "VAMPIRE" });
    expect(engine.getPrivateState(target.id).revealedRoles).toHaveLength(players.length);
  });

  it("oda ayarı kapalıysa ölü oyuncuya diğer rolleri göstermez", () => {
    const engine = new VampireVillageEngine(players, settings({ deadCanSeeRoles: false }));
    engine.start();
    engine.advancePhase();
    const internal = players.map((player) => engine.getInternalPlayer(player.id)!);
    const vampire = internal.find((player) => player.role === "VAMPIRE")!;
    const target = internal.find((player) => player.role === "VILLAGER")!;
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: target.id });
    engine.advancePhase();
    expect(engine.getPrivateState(target.id)).toMatchObject({ deathCause: "VAMPIRE", revealedRoles: [] });
  });

  it("ölü oyuncunun oy kullanmasını ve yaşayan sohbetine yazmasını engeller", () => {
    const engine = startedEngine();
    const internal = players.map((player) => engine.getInternalPlayer(player.id)!);
    const vampire = internal.find((player) => player.role === "VAMPIRE")!;
    const deadTarget = internal.find((player) => player.role === "VILLAGER")!;
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: deadTarget.id });
    engine.advancePhase();
    engine.advancePhase();
    expect(() => engine.handleAction(deadTarget.id, { type: "VOTE", targetId: vampire.id })).toThrow(/Elenen/);
    expect(() => assertCanUseChat(engine.getInternalPlayer(deadTarget.id)!, "DAY_DISCUSSION", "DAY")).toThrow();
  });

  it("yanlış oyun fazında oy ve gece eylemini reddeder", () => {
    const engine = new VampireVillageEngine(players, settings());
    engine.start();
    const first = players[0]!.id;
    const second = players[1]!.id;
    expect(() => engine.handleAction(first, { type: "VOTE", targetId: second })).toThrow(/yalnızca gündüz/);
    expect(() => engine.handleAction(first, { type: "NIGHT_ACTION", targetId: second })).toThrow(/yalnızca gece/);
  });

  it("Vampir olmayan oyuncuyu Vampir sohbetinden uzak tutar", () => {
    const engine = startedEngine();
    const villager = players.map((player) => engine.getInternalPlayer(player.id)!).find((player) => player.role === "VILLAGER")!;
    expect(() => assertCanUseChat(villager, "NIGHT", "VAMPIRE")).toThrow(/Vampir sohbetine/);
  });

  it("gündüz oylamasında en çok oy alan yaşayan oyuncuyu eler", () => {
    const engine = startedEngine();
    engine.advancePhase();
    engine.advancePhase();
    const internal = players.map((player) => engine.getInternalPlayer(player.id)!);
    const target = internal.find((player) => player.role !== "VAMPIRE")!;
    for (const voter of internal.filter((player) => player.id !== target.id)) {
      engine.handleAction(voter.id, { type: "VOTE", targetId: target.id });
    }
    engine.advancePhase();
    expect(engine.getInternalPlayer(target.id)?.isAlive).toBe(false);
    expect(engine.getPrivateState(target.id)).toMatchObject({ deathCause: "VOTE" });
  });

  it("açık oylamada oy tercihlerini yayınlar, gizli oylamada yalnızca sayıyı gösterir", () => {
    const publicEngine = new VampireVillageEngine(players, settings({ voteVisibility: "PUBLIC" }));
    publicEngine.start();
    publicEngine.advancePhase();
    publicEngine.advancePhase();
    publicEngine.advancePhase();
    publicEngine.handleAction(players[0]!.id, { type: "VOTE", targetId: players[1]!.id });
    expect(publicEngine.getPublicState()).toMatchObject({
      votesCast: 1,
      votedPlayerIds: [players[0]!.id],
      publicVotes: [{ voterId: players[0]!.id, targetId: players[1]!.id }]
    });

    const secretEngine = new VampireVillageEngine(players, settings({ voteVisibility: "SECRET" }));
    secretEngine.start();
    secretEngine.advancePhase();
    secretEngine.advancePhase();
    secretEngine.advancePhase();
    secretEngine.handleAction(players[0]!.id, { type: "VOTE", targetId: players[1]!.id });
    expect(secretEngine.getPublicState()).toMatchObject({
      votesCast: 1,
      votedPlayerIds: [players[0]!.id],
      publicVotes: []
    });
  });

  it("eşit oylarda NO_ELIMINATION kuralıyla kimseyi elemez", () => {
    const engine = startedEngine();
    engine.advancePhase();
    engine.advancePhase();
    const alive = players.map((player) => engine.getInternalPlayer(player.id)!);
    engine.handleAction(alive[0]!.id, { type: "VOTE", targetId: alive[1]!.id });
    engine.handleAction(alive[1]!.id, { type: "VOTE", targetId: alive[0]!.id });
    engine.advancePhase();
    expect(alive.every((player) => engine.getInternalPlayer(player.id)?.isAlive)).toBe(true);
  });

  it("oylamayı geç seçeneğini oy olarak kabul eder ve kimseyi elemez", () => {
    const engine = startedEngine();
    engine.advancePhase();
    engine.advancePhase();
    for (const voter of players) {
      engine.handleAction(voter.id, { type: "VOTE", targetId: SKIP_VOTE_ID });
    }
    engine.advancePhase();
    expect(players.every((player) => engine.getInternalPlayer(player.id)?.isAlive)).toBe(true);
    expect(engine.getPublicState().lastVoteTally).toEqual([
      { targetId: SKIP_VOTE_ID, count: players.length, voterIds: [] }
    ]);
  });

  it("oylama sonunda açık odada simgeler için seçmenleri, gizli odada yalnızca adetleri saklar", () => {
    const publicEngine = new VampireVillageEngine(players, settings({ voteVisibility: "PUBLIC" }));
    publicEngine.start();
    publicEngine.advancePhase();
    publicEngine.advancePhase();
    publicEngine.advancePhase();
    publicEngine.handleAction(players[0]!.id, { type: "VOTE", targetId: players[1]!.id });
    publicEngine.advancePhase();
    expect(publicEngine.getPublicState().lastVoteTally).toEqual([
      { targetId: players[1]!.id, count: 1, voterIds: [players[0]!.id] }
    ]);

    const secretEngine = new VampireVillageEngine(players, settings({ voteVisibility: "SECRET" }));
    secretEngine.start();
    secretEngine.advancePhase();
    secretEngine.advancePhase();
    secretEngine.advancePhase();
    secretEngine.handleAction(players[0]!.id, { type: "VOTE", targetId: players[1]!.id });
    secretEngine.advancePhase();
    expect(secretEngine.getPublicState().lastVoteTally).toEqual([
      { targetId: players[1]!.id, count: 1, voterIds: [] }
    ]);
  });
});

describe("kazanan kontrolü", () => {
  const player = (role: InternalPlayer["role"], isAlive = true): InternalPlayer => ({
    id: Math.random().toString(),
    nickname: "test",
    role,
    isAlive,
    connected: true,
    eliminationRound: null,
    deathCause: null,
    previousProtectionTarget: null
  });

  it("ayni gece eylemini ikinci kez reddeder", () => {
    const engine = startedEngine();
    const internal = players.map((item) => engine.getInternalPlayer(item.id)!);
    const vampire = internal.find((item) => item.role === "VAMPIRE")!;
    const targets = internal.filter((item) => item.role !== "VAMPIRE");
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: targets[0]!.id });
    expect(() => engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: targets[1]!.id })).toThrow();
  });

  it("ilk gece parite olussa bile tam gunduz oylamasindan once oyunu bitirmez", () => {
    const freePlayers = players.slice(0, 3);
    const engine = new VampireVillageEngine(freePlayers, settings({
      mode: "FREE",
      roles: { vampires: 1, villagers: 2, doctors: 0 }
    }));
    engine.start();
    engine.advancePhase();
    const internal = freePlayers.map((item) => engine.getInternalPlayer(item.id)!);
    const vampire = internal.find((item) => item.role === "VAMPIRE")!;
    const villager = internal.find((item) => item.role === "VILLAGER")!;
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: villager.id });
    expect(engine.advancePhase()).toBe("DAY_DISCUSSION");
    expect(engine.getPublicState().winner).toBeNull();
  });

  it("oyun bittiginde de public state rol bilgisi sizdirmaz", () => {
    const freePlayers = players.slice(0, 3);
    const engine = new VampireVillageEngine(freePlayers, settings({
      mode: "FREE",
      roles: { vampires: 1, villagers: 2, doctors: 0 }
    }));
    engine.start();
    engine.advancePhase();
    const internal = freePlayers.map((item) => engine.getInternalPlayer(item.id)!);
    const vampire = internal.find((item) => item.role === "VAMPIRE")!;
    const villagers = internal.filter((item) => item.role === "VILLAGER");
    engine.handleAction(vampire.id, { type: "NIGHT_ACTION", targetId: villagers[0]!.id });
    engine.advancePhase();
    engine.advancePhase();
    engine.handleAction(vampire.id, { type: "VOTE", targetId: villagers[1]!.id });
    engine.handleAction(villagers[1]!.id, { type: "VOTE", targetId: vampire.id });
    expect(engine.advancePhase()).toBe("FINISHED");
    expect(engine.getPublicState().players.every((item) => !("role" in item))).toBe(true);
  });

  it("Vampir kalmadığında köyü kazanan ilan eder", () => {
    expect(checkWinner([player("VAMPIRE", false), player("VILLAGER")], 1)).toBe("VILLAGE");
  });

  it("tam gece-gündüz döngüsünden önce köy için de kazanan ilan etmez", () => {
    expect(checkWinner([player("VAMPIRE", false), player("VILLAGER")], 0)).toBeNull();
  });

  it("Vampirler diğer yaşayanlara eşitlendiğinde Vampirleri kazanan ilan eder", () => {
    expect(checkWinner([player("VAMPIRE"), player("VILLAGER")], 1)).toBe("VAMPIRES");
  });

  it("serbest mod başlangıcında anında kazanan ilan etmez", () => {
    expect(checkWinner([player("VAMPIRE"), player("VAMPIRE"), player("VILLAGER")], 0)).toBeNull();
  });
});
