import { ArrowLeft, Check, Clock3, Crown, HeartPulse, LoaderCircle, Moon, Shield, Skull, Sparkles, Sun, Vote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "../../../components/ChatPanel";
import { PageShell } from "../../../components/PageShell";
import { useCountdown } from "../../../hooks/useCountdown";
import { useRoomSocket } from "../../../hooks/useRoomSocket";
import { clearRoomSession } from "../../../services/roomSession";
import { emitAck } from "../../../services/socket";
import type { ChatMessage, GamePlayer, Role } from "../../../types";

const phaseNames = {
  WAITING: "Bekleniyor",
  ROLE_REVEAL: "Rolünü öğren",
  NIGHT: "Gece",
  DAY_DISCUSSION: "Gündüz tartışması",
  DAY_VOTING: "Kasaba oylaması",
  ROUND_RESULT: "Tur sonucu",
  FINISHED: "Oyun sona erdi"
};

const roleTheme: Record<Role, { icon: typeof Skull; className: string }> = {
  VAMPIRE: { icon: Skull, className: "border-rose-400/20 bg-rose-500/[.08] text-rose-200" },
  VILLAGER: { icon: Sun, className: "border-sky-400/20 bg-sky-500/[.08] text-sky-200" },
  DOCTOR: { icon: HeartPulse, className: "border-emerald-400/20 bg-emerald-500/[.08] text-emerald-200" }
};

const roleNames: Record<Role, string> = {
  VAMPIRE: "Vampir",
  VILLAGER: "Köylü",
  DOCTOR: "Doktor"
};

export function GamePage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { room, game, privateState, messages, error, session, sendChat, connectionState } = useRoomSocket(code);
  const [selected, setSelected] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const seconds = useCountdown(game?.phaseEndsAt);

  const chatChannel: ChatMessage["type"] = !privateState?.isAlive
    ? "DEAD"
    : game?.phase === "NIGHT" && privateState.role === "VAMPIRE"
      ? "VAMPIRE"
      : "DAY";
  const chatEnabled =
    chatChannel === "DEAD" ||
    (chatChannel === "VAMPIRE" && game?.phase === "NIGHT") ||
    (chatChannel === "DAY" && game?.phase === "DAY_DISCUSSION");
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.isSystem || message.type === chatChannel),
    [messages, chatChannel]
  );

  useEffect(() => {
    setSelected("");
    setActionError("");
    setActionPending(false);
  }, [game?.phase, game?.round]);

  const submitAction = async () => {
    if (!selected || !game) return;
    try {
      setActionPending(true);
      setActionError("");
      if (game.phase === "NIGHT") await emitAck("game:night-action", { targetId: selected });
      else await emitAck("game:vote", { targetId: selected });
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "Eylem gönderilemedi.");
    } finally {
      setActionPending(false);
    }
  };

  const leave = async () => {
    try {
      await emitAck("room:leave");
    } finally {
      clearRoomSession(code);
      navigate("/");
    }
  };

  if (!room || !game || !privateState) {
    return (
      <PageShell>
        <div className="grid min-h-[60vh] place-items-center text-center">
          {error ? (
            <div><p className="text-rose-300">{error}</p><button className="btn-secondary mt-5" onClick={() => navigate("/rooms/join")}><ArrowLeft size={16} /> Geri dön</button></div>
          ) : (
            <div><LoaderCircle className="mx-auto animate-spin text-rose-300" /><p className="mt-4 text-sm text-mist">Gece perdesi açılıyor...</p></div>
          )}
        </div>
      </PageShell>
    );
  }

  const myTheme = roleTheme[privateState.role];
  const RoleIcon = myTheme.icon;
  const canActAtNight = game.phase === "NIGHT" && privateState.isAlive && privateState.role !== "VILLAGER";
  const canVote = game.phase === "DAY_VOTING" && privateState.isAlive;
  const showActionPanel = canActAtNight || canVote;
  const actionAlreadySubmitted = canActAtNight
    ? privateState.submittedNightAction
    : canVote && !room.settings.canChangeVote
      ? Boolean(privateState.currentVote)
      : false;
  const phaseExpired = Boolean(game.phaseEndsAt) && seconds === 0;
  const actionLocked = actionPending || actionAlreadySubmitted || phaseExpired || connectionState !== "connected";
  const targets = game.players.filter((player) =>
    player.isAlive &&
    !(canActAtNight && privateState.role === "VAMPIRE" && player.id === session?.playerId) &&
    !(canVote && !room.settings.canSelfVote && player.id === session?.playerId) &&
    !(canActAtNight && privateState.role === "DOCTOR" && !room.settings.doctorCanSelfProtect && player.id === session?.playerId)
  );
  const revealedRoleByPlayer = new Map(privateState.revealedRoles.map((item) => [item.playerId, item.role]));
  const playerNameById = new Map(game.players.map((player) => [player.id, player.nickname]));
  const votersByTarget = new Map<string, string[]>();
  game.publicVotes.forEach(({ voterId, targetId }) => {
    const voters = votersByTarget.get(targetId) ?? [];
    voters.push(playerNameById.get(voterId) ?? "Oyuncu");
    votersByTarget.set(targetId, voters);
  });

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {game.phase === "NIGHT" ? <Moon size={15} className="text-indigo-300" /> : <Sun size={15} className="text-amber-300" />}
            <p className="eyebrow">{game.round}. TUR · {room.name}</p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">{phaseNames[game.phase]}</h1>
        </div>
        <div className="flex items-center gap-3">
          {game.phaseEndsAt && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/[.08] bg-white/[.03] px-4 py-2.5">
              <Clock3 size={16} className={seconds <= 10 ? "text-rose-300" : "text-mist"} />
              <span className="font-display text-xl tabular-nums">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
            </div>
          )}
          <span className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-3 text-xs text-mist">{room.code}</span>
        </div>
      </div>

      {connectionState !== "connected" && (
        <div className="mb-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-sm text-amber-100" role="status">
          {connectionState === "reconnecting" || connectionState === "connecting"
            ? "Bağlantı yeniden kuruluyor; oyun eylemleri geçici olarak durduruldu."
            : "Sunucuyla bağlantı kesildi. İnternet bağlantınızı kontrol edin."}
        </div>
      )}

      {game.lastResult && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-indigo-400/10 bg-indigo-400/[.04] p-4 text-sm text-moon/80">
          <Sparkles size={17} className="shrink-0 text-indigo-300" /> {game.lastResult}
        </div>
      )}
      {actionError && <div className="mb-5 rounded-2xl border border-rose-400/15 bg-rose-500/[.06] p-4 text-sm text-rose-200">{actionError}</div>}
      {!privateState.isAlive && (
        <section className="mb-5 flex items-start gap-4 rounded-3xl border border-rose-400/20 bg-rose-500/[.08] p-5 text-rose-100 shadow-panel">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-500/15"><Skull size={23} /></span>
          <div>
            <p className="eyebrow text-rose-300">ELENDİN</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              {privateState.deathCause === "VAMPIRE"
                ? "Vampirler tarafından katledildin."
                : privateState.deathCause === "VOTE"
                  ? "Kasaba seni oylamayla eledi."
                  : "Artık yaşayanlar arasında değilsin."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-100/70">
              {room.settings.deadCanSeeRoles
                ? "Artık herkesin rolünü görebilir ve ölüler sohbetinde konuşabilirsin; fakat oy kullanamazsın."
                : "Ölüler sohbetinde konuşabilirsin; yaşayanların kararlarına ve oylamaya müdahale edemezsin."}
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[.72fr_1.35fr_.9fr]">
        <div className="space-y-5">
          <section className={`rounded-3xl border p-5 shadow-panel ${myTheme.className}`}>
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/20"><RoleIcon size={21} /></span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">GİZLİ ROLÜN</span>
            </div>
            <h2 className="mt-8 font-display text-3xl font-semibold">{privateState.roleInfo.name}</h2>
            <p className="mt-2 text-sm leading-6 opacity-75">{privateState.roleInfo.description}</p>
            <div className="mt-5 border-t border-current/10 pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">AMACIN</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{privateState.roleInfo.goal}</p>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-white/[.06] px-5 py-4">
              <p className="eyebrow">KASABA</p>
              <h2 className="mt-1 text-sm font-semibold">{game.players.filter((player) => player.isAlive).length} kişi hayatta</h2>
            </div>
            <div className="divide-y divide-white/[.05]">
              {game.players.map((player) => (
                <GamePlayerRow
                  key={player.id}
                  player={player}
                  isMe={player.id === session?.playerId}
                  owner={player.id === room.ownerPlayerId}
                  revealedRole={revealedRoleByPlayer.get(player.id)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {showActionPanel ? (
            <section className="panel p-5 sm:p-6">
              <p className="eyebrow">{canVote ? "OYUNU KULLAN" : privateState.role === "DOCTOR" ? "KORUYACAĞIN KİŞİ" : "GECE HEDEFİN"}</p>
              <h2 className="mt-2 text-xl font-semibold">{canVote ? "Kasaba kimi gönderecek?" : privateState.role === "DOCTOR" ? "Bu gece kimi hayatta tutacaksın?" : "Gölgeler kimi bulacak?"}</h2>
              <p className="mt-1 text-sm text-mist">
                {canVote
                  ? `${room.settings.voteVisibility === "PUBLIC" ? "Açık" : "Gizli"} oylama · ${game.votesCast} oy kullanıldı`
                  : "Kararını süre dolmadan gönder."}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {targets.map((player) => (
                  <button
                    key={player.id}
                    disabled={actionLocked}
                    onClick={() => setSelected(player.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selected === player.id ? "border-rose-400/35 bg-rose-500/[.08]" : "border-white/[.06] bg-white/[.025] hover:border-white/[.12]"}`}
                  >
                    <span className="avatar h-9 w-9 shrink-0 text-[10px] font-bold">{player.nickname.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{player.nickname}</span>
                      {canVote && room.settings.voteVisibility === "PUBLIC" && Boolean(votersByTarget.get(player.id)?.length) && (
                        <span className="mt-0.5 block truncate text-[10px] text-mist">{votersByTarget.get(player.id)!.join(", ")} oy verdi</span>
                      )}
                    </span>
                    {canVote && room.settings.voteVisibility === "PUBLIC" && Boolean(votersByTarget.get(player.id)?.length) && (
                      <span className="rounded-full bg-white/[.06] px-2 py-1 text-[10px] font-bold">{votersByTarget.get(player.id)!.length}</span>
                    )}
                    {selected === player.id && <Check size={16} className="text-rose-300" />}
                  </button>
                ))}
              </div>
              <button className="btn-primary mt-5 w-full justify-center" disabled={!selected || actionLocked} onClick={() => void submitAction()}>
                {actionAlreadySubmitted ? <><Check size={17} /> Kararın alındı</> : actionPending ? <><LoaderCircle size={17} className="animate-spin" /> Gönderiliyor</> : canVote ? <><Vote size={17} /> {privateState.currentVote ? "Oyumu güncelle" : "Oyumu gönder"}</> : <><Shield size={17} /> Kararımı gönder</>}
              </button>
            </section>
          ) : (
            <section className="panel grid min-h-64 place-items-center p-8 text-center">
              <div>
                {game.phase === "NIGHT" ? <Moon className="mx-auto text-indigo-300" size={28} /> : <Sun className="mx-auto text-amber-300" size={28} />}
                <h2 className="mt-4 text-lg font-semibold">
                  {!privateState.isAlive ? "Artık gölgeler arasındasın." : game.phase === "NIGHT" ? "Kasaba uyuyor." : "Söz sırası kasabada."}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mist">
                  {!privateState.isAlive ? "Yaşayanların kararlarına müdahale edemezsin; ölüler sohbetinde konuşabilirsin." : game.phase === "NIGHT" && privateState.role === "VILLAGER" ? "Köylünün gece eylemi yok. Güneşin doğmasını bekle." : "Tartışmayı dikkatle takip et. Oylama birazdan başlayacak."}
                </p>
              </div>
            </section>
          )}

          {game.phase === "ROLE_REVEAL" && (
            <section className={`rounded-3xl border p-6 text-center ${myTheme.className}`}>
              <RoleIcon className="mx-auto" size={32} />
              <p className="eyebrow mt-5">BU KART YALNIZCA SANA AİT</p>
              <h2 className="mt-2 font-display text-4xl font-semibold">{privateState.roleInfo.name}</h2>
              <p className="mt-3 text-sm leading-6 opacity-80">{privateState.roleInfo.ability}</p>
            </section>
          )}
        </div>

        <ChatPanel messages={visibleMessages} channel={chatChannel} disabled={!chatEnabled || connectionState !== "connected"} onSend={(message) => sendChat(chatChannel, message)} />
      </div>

      {game.phase === "FINISHED" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/90 p-5 backdrop-blur-xl">
          <div className="panel w-full max-w-2xl p-7 text-center sm:p-10">
            {game.winner === "VILLAGE" ? <Sun className="mx-auto text-amber-300" size={36} /> : <Skull className="mx-auto text-rose-300" size={36} />}
            <p className="eyebrow mt-5">OYUN SONA ERDİ</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">{game.winner === "VILLAGE" ? "Kasaba kazandı" : "Vampirler kazandı"}</h2>
            <p className="mt-3 text-sm text-mist">{game.round} tur sonunda oyun tamamlandı.</p>
            <div className="mt-7 grid gap-2 sm:grid-cols-2">
              {game.players.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.025] p-3 text-left">
                  <div><p className="text-sm font-semibold">{player.nickname}</p><p className="mt-0.5 text-[10px] text-mist">{player.isAlive ? "Hayatta kaldı" : `${player.eliminationRound}. turda elendi`}</p></div>
                  <span className="text-xs font-bold text-mist">{player.isAlive ? "Hayatta" : "Elendi"}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              {room.ownerPlayerId === session?.playerId && (
                <button className="btn-primary justify-center" onClick={() => void emitAck("room:rematch").then(() => navigate(`/rooms/${code}/lobby`))}>Tekrar oyna</button>
              )}
              <button className="btn-secondary justify-center" onClick={() => navigate(`/rooms/${code}/lobby`)}>Odaya dön</button>
              <button className="btn-ghost justify-center" onClick={() => void leave()}>Odadan ayrıl</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function GamePlayerRow({ player, isMe, owner, revealedRole }: { player: GamePlayer; isMe: boolean; owner: boolean; revealedRole?: Role }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 ${!player.isAlive ? "opacity-45" : ""}`}>
      <div className={`avatar ${!player.isAlive ? "avatar-dead" : ""}`}>{player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <Skull size={16} />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{player.nickname}</span>
          {owner && <Crown size={13} className="text-amber-300" />}
          {isMe && <span className="text-[9px] font-black uppercase tracking-wider text-rose-300">Sen</span>}
        </div>
        <p className="mt-0.5 text-[10px] text-mist">{player.isAlive ? (player.connected === false ? "Bağlantısı koptu" : "Hayatta") : "Elendi"}</p>
      </div>
      {revealedRole && (
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${revealedRole === "VAMPIRE" ? "bg-rose-500/10 text-rose-300" : revealedRole === "DOCTOR" ? "bg-emerald-500/10 text-emerald-300" : "bg-sky-500/10 text-sky-300"}`}>
          {roleNames[revealedRole]}
        </span>
      )}
      <span className={`h-2 w-2 rounded-full ${player.isAlive ? "bg-emerald-400" : "bg-rose-400/40"}`} />
    </div>
  );
}
