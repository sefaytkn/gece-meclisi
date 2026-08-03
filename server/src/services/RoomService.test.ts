import { describe, expect, it } from "vitest";
import { RoomService, type SocketIdentity } from "./RoomService.js";
import { bindGameAction, getChatRecipientSocketIds } from "../socket/setupSocket.js";

const identity = (index: number): SocketIdentity => ({
  userId: `user-${index}`,
  guestId: `guest-${index}`,
  nickname: `Oyuncu ${index}`,
  socketId: `socket-${index}`
});

async function fullRoom() {
  const service = new RoomService();
  const owner = await service.createRoom({ name: "Gece Ekibi", maxPlayers: 8 }, identity(1));
  const joins = [];
  for (let index = 2; index <= 4; index += 1) {
    joins.push(await service.joinRoom({ code: owner.room.code }, identity(index)));
  }
  return { service, owner, joins };
}

describe("RoomService yetkilendirme ve yeniden bağlanma", () => {
  it("oda oluşturur ve kodla yeni oyuncu katılmasına izin verir", async () => {
    const service = new RoomService();
    const created = await service.createRoom({ name: "Yeni Oda", maxPlayers: 4 }, identity(1));
    const joined = await service.joinRoom({ code: created.room.code.toLowerCase() }, identity(2));
    expect(created.room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(joined.room.players).toHaveLength(2);
    expect(joined.playerId).not.toBe(created.playerId);
  });

  it("dolu odaya yeni oyuncu almaz", async () => {
    const service = new RoomService();
    const created = await service.createRoom({ name: "Dolu Oda", maxPlayers: 4 }, identity(1));
    for (let index = 2; index <= 4; index += 1) {
      await service.joinRoom({ code: created.room.code }, identity(index));
    }
    await expect(service.joinRoom({ code: created.room.code }, identity(5))).rejects.toThrow(/dolu/);
  });

  it("oyun başlamış odaya yeni oyuncu almaz", async () => {
    const { service, owner, joins } = await fullRoom();
    const all = [owner.playerId, ...joins.map((join) => join.playerId)];
    all.forEach((playerId) => service.setReady(owner.room.code, playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    await expect(service.joinRoom({ code: owner.room.code }, identity(5))).rejects.toThrow(/başladıktan sonra/);
  });

  it("oda sahipliğini odadaki başka oyuncuya aktarır", async () => {
    const { service, owner, joins } = await fullRoom();
    const room = service.transferOwner(owner.room.code, owner.playerId, joins[0]!.playerId);
    expect(room.ownerPlayerId).toBe(joins[0]!.playerId);
  });

  it("son oyuncu ayrıldığında boş odayı temizler", async () => {
    const service = new RoomService();
    const created = await service.createRoom({ name: "Tek Kişi", maxPlayers: 4 }, identity(1));
    expect(service.leaveRoom(created.room.code, created.playerId).deleted).toBe(true);
    expect(() => service.getRoom(created.room.code)).toThrow(/bulunamadı/);
  });
  it("public oda state'inde dahili kimlik ve token alanlarını yayınlamaz", async () => {
    const service = new RoomService();
    const created = await service.createRoom({ name: "Gizli Oda", maxPlayers: 8 }, identity(1));
    const publicPlayer = created.room.players[0] as Record<string, unknown>;

    expect(publicPlayer).not.toHaveProperty("socketId");
    expect(publicPlayer).not.toHaveProperty("reconnectToken");
    expect(publicPlayer).not.toHaveProperty("guestId");
    expect(publicPlayer).not.toHaveProperty("userId");
  });

  it("oda sahibi olmayan oyuncunun ayar değiştirmesini engeller", async () => {
    const { service, owner, joins } = await fullRoom();
    expect(() => service.updateSettings(owner.room.code, joins[0]!.playerId, owner.room.settings)).toThrow(/yalnızca oda sahibi/);
  });

  it("rol toplamı eşleşmeden oyunun başlamasını engeller", async () => {
    const { service, owner, joins } = await fullRoom();
    const all = [owner.playerId, ...joins.map((join) => join.playerId)];
    all.forEach((playerId) => service.setReady(owner.room.code, playerId, true));
    service.updateSettings(owner.room.code, owner.playerId, {
      ...owner.room.settings,
      roles: { vampires: 1, villagers: 2, doctors: 0 }
    });
    expect(() => service.startGame(owner.room.code, owner.playerId)).toThrow(/oyuncu sayısına eşit/);
  });

  it("geçerli token ile yeniden bağlanan oyuncuya doğru özel state'i verir", async () => {
    const { service, owner, joins } = await fullRoom();
    const all = [owner.playerId, ...joins.map((join) => join.playerId)];
    all.forEach((playerId) => service.setReady(owner.room.code, playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    service.disconnect("socket-2");
    const reconnected = await service.joinRoom(
      { code: owner.room.code, reconnectToken: joins[0]!.reconnectToken },
      { ...identity(2), socketId: "socket-new" }
    );
    expect(reconnected.playerId).toBe(joins[0]!.playerId);
    expect(reconnected.privateState).toMatchObject({ playerId: joins[0]!.playerId });
    expect(reconnected.replacedSocketId).toBe("socket-2");
    expect(reconnected.room.players).toHaveLength(4);
  });

  it("ayrılma yanıtı kaybolsa bile aynı tarayıcının girişini tek oyuncu olarak uzlaştırır", async () => {
    const service = new RoomService();
    const owner = await service.createRoom({ name: "Tekrar Giriş", maxPlayers: 8 }, identity(1));
    const firstJoin = await service.joinRoom({ code: owner.room.code }, identity(2));

    const recovered = await service.joinRoom(
      { code: owner.room.code },
      { ...identity(2), socketId: "socket-2-new" }
    );

    expect(recovered.playerId).toBe(firstJoin.playerId);
    expect(recovered.reconnectToken).toBe(firstJoin.reconnectToken);
    expect(recovered.replacedSocketId).toBe("socket-2");
    expect(recovered.room.players).toHaveLength(2);
  });

  it("odadan ayrılan tarayıcının aynı odaya temiz bir oyuncu olarak yeniden girmesine izin verir", async () => {
    const service = new RoomService();
    const owner = await service.createRoom({ name: "Geri Dönüş", maxPlayers: 8 }, identity(1));
    const firstJoin = await service.joinRoom({ code: owner.room.code }, identity(2));
    service.leaveRoom(owner.room.code, firstJoin.playerId);

    const secondJoin = await service.joinRoom(
      { code: owner.room.code },
      { ...identity(2), socketId: "socket-2-returned" }
    );

    expect(secondJoin.playerId).not.toBe(firstJoin.playerId);
    expect(secondJoin.reconnectToken).not.toBe(firstJoin.reconnectToken);
    expect(secondJoin.room.players).toHaveLength(2);
  });

  it("başka oyuncunun reconnect token'ını kabul etmez", async () => {
    const { service, owner, joins } = await fullRoom();
    await expect(
      service.joinRoom(
        { code: owner.room.code, reconnectToken: joins[0]!.reconnectToken },
        { ...identity(99), socketId: "socket-attacker" }
      )
    ).rejects.toThrow(/ait değil/);
    expect(service.getRoom(owner.room.code).players).toHaveLength(4);
  });

  it("gece action sonrasında reconnect ile submitted private state'i geri verir", async () => {
    const { service, owner, joins } = await fullRoom();
    const entries = [owner, ...joins];
    entries.forEach((entry) => service.setReady(owner.room.code, entry.playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    const room = service.getInternalRoom(owner.room.code);
    room.engine!.advancePhase();
    const actor = room.players.find((candidate) => room.engine!.getInternalPlayer(candidate.id)?.role !== "VILLAGER")!;
    const actorIndex = room.players.indexOf(actor);
    const actorRole = room.engine!.getInternalPlayer(actor.id)!.role;
    const target = room.players.find((candidate) =>
      candidate.id !== actor.id && (actorRole !== "VAMPIRE" || room.engine!.getInternalPlayer(candidate.id)?.role !== "VAMPIRE")
    )!;
    room.engine!.handleAction(actor.id, { type: "NIGHT_ACTION", targetId: target.id });
    service.disconnect(actor.socketId);
    const reconnected = await service.joinRoom(
      { code: room.code, reconnectToken: entries[actorIndex]!.reconnectToken },
      { ...identity(actorIndex + 1), socketId: "socket-night-reconnect" }
    );
    expect(reconnected.privateState).toMatchObject({ submittedNightAction: true });
    expect(reconnected.room.players).toHaveLength(4);
  });

  it("oylama sonrasında reconnect ile currentVote private state'ini geri verir", async () => {
    const { service, owner, joins } = await fullRoom();
    const entries = [owner, ...joins];
    entries.forEach((entry) => service.setReady(owner.room.code, entry.playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    const room = service.getInternalRoom(owner.room.code);
    room.engine!.advancePhase();
    room.engine!.advancePhase();
    room.engine!.advancePhase();
    const actor = room.players[1]!;
    const target = room.players.find((candidate) => candidate.id !== actor.id)!;
    room.engine!.handleAction(actor.id, { type: "VOTE", targetId: target.id });
    service.disconnect(actor.socketId);
    const reconnected = await service.joinRoom(
      { code: room.code, reconnectToken: entries[1]!.reconnectToken },
      { ...identity(2), socketId: "socket-vote-reconnect" }
    );
    expect(reconnected.privateState).toMatchObject({ currentVote: target.id });
    expect(reconnected.room.players).toHaveLength(4);
  });

  it("geçersiz reconnect token ile yeni oyuncu yaratmaz", async () => {
    const { service, owner } = await fullRoom();
    await expect(
      service.joinRoom(
        { code: owner.room.code, reconnectToken: "invalid-token" },
        { ...identity(2), socketId: "socket-new" }
      )
    ).rejects.toThrow(/geçersiz/);
    expect(service.getRoom(owner.room.code).players).toHaveLength(4);
  });

  it("oy aksiyonunu payload içindeki sahte oyuncu yerine socket oyuncusuna bağlar", () => {
    const action = bindGameAction("authenticated-player", "VOTE", {
      playerId: "victim-player",
      targetId: "target-player"
    });
    expect(action.actorPlayerId).toBe("authenticated-player");
    expect(action.action).toEqual({ type: "VOTE", targetId: "target-player" });
    expect(action).not.toHaveProperty("playerId");
  });

  it("Vampir sohbet alıcılarına Vampir olmayan socket'leri dahil etmez", async () => {
    const { service, owner, joins } = await fullRoom();
    const all = [owner.playerId, ...joins.map((join) => join.playerId)];
    all.forEach((playerId) => service.setReady(owner.room.code, playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    const room = service.getInternalRoom(owner.room.code);
    const recipients = getChatRecipientSocketIds(room, "VAMPIRE");
    const recipientPlayers = room.players.filter((player) => recipients.includes(player.socketId));
    expect(recipientPlayers.length).toBeGreaterThan(0);
    expect(
      recipientPlayers.every((player) => room.engine?.getInternalPlayer(player.id)?.role === "VAMPIRE")
    ).toBe(true);
  });

  it("ölü sohbet alıcılarına yaşayan socket'leri dahil etmez", async () => {
    const { service, owner, joins } = await fullRoom();
    const all = [owner.playerId, ...joins.map((join) => join.playerId)];
    all.forEach((playerId) => service.setReady(owner.room.code, playerId, true));
    service.startGame(owner.room.code, owner.playerId);
    const room = service.getInternalRoom(owner.room.code);
    room.engine!.removePlayer(joins[0]!.playerId);
    const recipients = getChatRecipientSocketIds(room, "DEAD");
    expect(recipients).toEqual([room.players.find((player) => player.id === joins[0]!.playerId)!.socketId]);
  });
});
