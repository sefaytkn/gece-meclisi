import { ArrowLeft, Check, CircleX, Clock3, Crown, Eye, EyeOff, HeartPulse, LoaderCircle, MessageCircle, Moon, Shield, SkipForward, Skull, Sparkles, Sun, Target, UsersRound, Vote, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "../../../components/ChatPanel";
import { PageShell } from "../../../components/PageShell";
import { useCountdown } from "../../../hooks/useCountdown";
import { useRoomSocket } from "../../../hooks/useRoomSocket";
import { clearRoomSession } from "../../../services/roomSession";
import { emitAck } from "../../../services/socket";
import type { ChatMessage, GamePlayer, GameState, Role } from "../../../types";

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

const SKIP_VOTE_ID = "__SKIP__";

export function GamePage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { room, game, privateState, messages, error, session, sendChat, connectionState } = useRoomSocket(code);
  const [selected, setSelected] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [roleVisible, setRoleVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const seconds = useCountdown(game?.phaseEndsAt, game?.serverNow);

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
    setRoleVisible(false);
  }, [game?.phase, game?.round]);

  useEffect(() => {
    if (privateState && !privateState.isAlive) setChatOpen(true);
  }, [privateState?.isAlive]);

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
  const actionCandidates = game.players;
  const revealedRoleByPlayer = new Map(privateState.revealedRoles.map((item) => [item.playerId, item.role]));
  const playerNameById = new Map(game.players.map((player) => [player.id, player.nickname]));
  const votersByTarget = new Map<string, string[]>();
  game.publicVotes.forEach(({ voterId, targetId }) => {
    const voters = votersByTarget.get(targetId) ?? [];
    voters.push(voterId);
    votersByTarget.set(targetId, voters);
  });
  const lastVoteTally = game.lastVoteTally ?? [];
  const showVoteResult = (game.phase === "ROUND_RESULT" || game.phase === "FINISHED") && lastVoteTally.length > 0;

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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <main className="min-w-0 space-y-5">
          <section className={`panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${roleVisible ? myTheme.className : ""}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${roleVisible ? "bg-black/20" : "bg-white/[.05] text-mist"}`}>
                {roleVisible ? <RoleIcon size={19} /> : <EyeOff size={18} />}
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.2em] opacity-60">GİZLİ ROLÜN</p>
                {roleVisible ? (
                  <>
                    <p className="mt-1 truncate text-sm font-bold">{privateState.roleInfo.name}</p>
                    <p className="mt-0.5 truncate text-xs opacity-70">{privateState.roleInfo.goal}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-bold text-white">Rolün gizlendi</p>
                    <p className="mt-0.5 text-xs text-mist">Yanındaki oyuncular ekranından rolünü göremez.</p>
                  </>
                )}
              </div>
            </div>
            <button className="btn-secondary shrink-0 justify-center px-4 text-xs" onClick={() => setRoleVisible((visible) => !visible)}>
              {roleVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              {roleVisible ? "Rolü gizle" : "Rolü göster"}
            </button>
          </section>

          {showVoteResult ? (
            <VoteResultPanel
              players={game.players}
              tally={lastVoteTally}
              playerNameById={playerNameById}
              voteVisibility={room.settings.voteVisibility}
            />
          ) : showActionPanel ? (
            <section className="panel overflow-hidden">
              <div className={`border-b p-5 sm:p-6 ${canVote ? "border-amber-300/10 bg-amber-300/[.035]" : privateState.role === "DOCTOR" ? "border-emerald-300/10 bg-emerald-300/[.035]" : "border-rose-300/10 bg-rose-300/[.035]"}`}>
                <div className="flex items-start gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${canVote ? "bg-amber-300/10 text-amber-200" : privateState.role === "DOCTOR" ? "bg-emerald-300/10 text-emerald-200" : "bg-rose-300/10 text-rose-200"}`}>
                    {canVote ? <Vote size={20} /> : privateState.role === "DOCTOR" ? <Shield size={20} /> : <Target size={20} />}
                  </span>
                  <div>
                    <p className="eyebrow">{canVote ? "KASABA OYLAMASI" : privateState.role === "DOCTOR" ? "GECE KORUMASI" : "VAMPİR SALDIRISI"}</p>
                    <h2 className="mt-2 text-xl font-semibold">{canVote ? "Kasaba kimi eleyecek?" : privateState.role === "DOCTOR" ? "Bu gece kimi koruyacaksın?" : "Bu gece kimi öldüreceksin?"}</h2>
                    <p className="mt-1 text-sm text-mist">
                      {canVote
                        ? `${room.settings.voteVisibility === "PUBLIC" ? "Açık" : "Gizli"} oylama · ${game.votesCast} kişi oy kullandı`
                        : "Bir oyuncu seç ve süre dolmadan kararını onayla."}
                    </p>
                    {canVote && <p className="mt-2 text-xs text-amber-100/60">Hayatta olan herkes oy verdiğinde oylama otomatik tamamlanır.</p>}
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {actionCandidates.map((player) => {
                    const unavailable =
                      !player.isAlive ||
                      (canVote && !room.settings.canSelfVote && player.id === session?.playerId) ||
                      (canActAtNight && privateState.role === "VAMPIRE" && player.id === session?.playerId) ||
                      (canActAtNight && privateState.role === "DOCTOR" && !room.settings.doctorCanSelfProtect && player.id === session?.playerId);
                    const voterIds = votersByTarget.get(player.id) ?? [];
                    return (
                    <button
                      key={player.id}
                      disabled={actionLocked || unavailable}
                      onClick={() => setSelected(player.id)}
                      className={`relative min-h-32 overflow-hidden rounded-2xl border p-4 text-left transition ${
                        !player.isAlive
                          ? "border-rose-400/15 bg-rose-950/25 opacity-55"
                          : selected === player.id
                            ? "border-rose-400/50 bg-rose-500/[.11] shadow-[0_0_0_1px_rgba(251,113,133,.08)]"
                            : "border-white/[.06] bg-white/[.025] hover:border-white/[.14] hover:bg-white/[.04]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`avatar h-12 w-12 shrink-0 text-xs font-black ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : ""}`}>
                          {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <CircleX size={23} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-bold ${!player.isAlive ? "line-through decoration-rose-400 decoration-2" : ""}`}>{player.nickname}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {player.id === session?.playerId && <span className="text-[9px] font-black uppercase tracking-wider text-rose-300">Sen</span>}
                            {player.id === room.ownerPlayerId && <Crown size={12} className="text-amber-300" />}
                          </span>
                        </span>
                      </span>
                      <span className="mt-4 block min-h-6">
                        {!player.isAlive && <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-rose-300">Öldü</span>}
                        {canVote && room.settings.voteVisibility === "PUBLIC" && voterIds.length > 0 && (
                          <span className="mt-2 flex flex-wrap gap-1">
                            {voterIds.map((voterId) => (
                              <span key={voterId} title={`${playerNameById.get(voterId) ?? "Oyuncu"} oy verdi`} className="grid h-5 w-5 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 text-[8px] font-black text-amber-200">
                                {(playerNameById.get(voterId) ?? "?").slice(0, 1).toUpperCase()}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      {canVote && room.settings.voteVisibility === "PUBLIC" && voterIds.length > 0 && (
                        <span className="absolute right-3 top-3 rounded-full bg-white/[.08] px-2 py-1 text-[10px] font-bold">{voterIds.length}</span>
                      )}
                      {selected === player.id && <span className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-rose-500 text-white"><Check size={16} /></span>}
                      {!player.isAlive && <DeadCross />}
                    </button>
                    );
                  })}
                </div>
                {canVote && (
                  <button
                    type="button"
                    disabled={actionLocked}
                    onClick={() => setSelected(SKIP_VOTE_ID)}
                    className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      selected === SKIP_VOTE_ID
                        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                        : "border-white/[.08] bg-white/[.025] text-mist hover:border-white/[.16] hover:text-white"
                    }`}
                  >
                    <SkipForward size={15} /> Oylamayı geç
                    {selected === SKIP_VOTE_ID && <Check size={14} className="ml-1" />}
                  </button>
                )}
                {selected && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/[.05] px-3 py-2 text-xs text-rose-100">
                    <Check size={14} className="shrink-0 text-rose-300" />
                    <span><strong>{selected === SKIP_VOTE_ID ? "Kimseye oy verme" : playerNameById.get(selected)}</strong> seçildi. Aşağıdaki düğmeyle kararını onayla.</span>
                  </div>
                )}
                <button className="btn-primary mt-5 w-full justify-center" disabled={!selected || actionLocked} onClick={() => void submitAction()}>
                  {actionAlreadySubmitted ? <><Check size={17} /> Kararın alındı</> : actionPending ? <><LoaderCircle size={17} className="animate-spin" /> Gönderiliyor</> : canVote ? <><Vote size={17} /> {privateState.currentVote ? "Oyumu güncelle" : "Oyumu gönder"}</> : <><Shield size={17} /> Kararımı gönder</>}
                </button>
              </div>
            </section>
          ) : (
            <PlayerBoard
              players={game.players}
              currentPlayerId={session?.playerId}
              ownerPlayerId={room.ownerPlayerId}
              revealedRoleByPlayer={revealedRoleByPlayer}
              phase={game.phase}
              isAlive={privateState.isAlive}
              role={privateState.role}
            />
          )}
        </main>

        <aside className={`grid items-start gap-3 xl:sticky xl:top-24 ${chatOpen ? "xl:grid-cols-[3.25rem_21rem]" : "xl:grid-cols-[3.25rem]"}`}>
          <nav className="panel flex gap-2 p-2 xl:flex-col" aria-label="Oyun araçları">
            <button
              className={`btn-icon relative ${chatOpen ? "border-rose-400/30 bg-rose-500/10 text-rose-200" : ""}`}
              onClick={() => setChatOpen((open) => !open)}
              aria-label={chatOpen ? "Sohbeti kapat" : "Sohbeti aç"}
              title={privateState.isAlive ? "Sohbet" : "Ölüler sohbeti"}
            >
              {chatOpen ? <X size={18} /> : <MessageCircle size={18} />}
              {!chatOpen && visibleMessages.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">{Math.min(99, visibleMessages.length)}</span>}
            </button>
            <button
              className={`btn-icon ${roleVisible ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-200" : ""}`}
              onClick={() => setRoleVisible((visible) => !visible)}
              aria-label={roleVisible ? "Rolü gizle" : "Rolü göster"}
              title={roleVisible ? "Rolü gizle" : "Rolü göster"}
            >
              {roleVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <div className="hidden h-px bg-white/[.06] xl:block" />
            <span className="btn-icon pointer-events-none" title={`${game.players.filter((player) => player.isAlive).length} kişi hayatta`}>
              <UsersRound size={18} />
            </span>
          </nav>
          {chatOpen && (
            <div className="min-w-0">
              {!privateState.isAlive && (
                <div className="mb-3 rounded-2xl border border-rose-400/15 bg-rose-500/[.06] px-4 py-3 text-xs text-rose-100">
                  Bu sohbeti yalnızca ölen oyuncular görebilir.
                </div>
              )}
              <ChatPanel messages={visibleMessages} channel={chatChannel} disabled={!chatEnabled || connectionState !== "connected"} onSend={(message) => sendChat(chatChannel, message)} />
            </div>
          )}
        </aside>
      </div>

      {game.phase === "FINISHED" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/90 p-5 backdrop-blur-xl">
          <div className="panel w-full max-w-2xl p-7 text-center sm:p-10">
            {game.winner === "VILLAGE" ? <Sun className="mx-auto text-amber-300" size={36} /> : <Skull className="mx-auto text-rose-300" size={36} />}
            <p className="eyebrow mt-5">OYUN SONA ERDİ</p>
            <h2 className="mt-3 font-display text-4xl font-semibold">{game.winner === "VILLAGE" ? "Kasaba kazandı" : "Vampirler kazandı"}</h2>
            <p className="mt-3 text-sm text-mist">{game.round} tur sonunda oyun tamamlandı.</p>
            {lastVoteTally.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-300/10 bg-amber-300/[.035] p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">SON OYLAMA</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastVoteTally.map((item) => (
                    <span key={item.targetId} className="rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1.5 text-xs">
                      {item.targetId === SKIP_VOTE_ID ? "Geç" : playerNameById.get(item.targetId) ?? "Oyuncu"} · <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
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

function VoteResultPanel({
  players,
  tally,
  playerNameById,
  voteVisibility
}: {
  players: GamePlayer[];
  tally: { targetId: string; count: number; voterIds: string[] }[];
  playerNameById: Map<string, string>;
  voteVisibility: "SECRET" | "PUBLIC";
}) {
  const tallyByTarget = new Map(tally.map((item) => [item.targetId, item]));
  const skipTally = tallyByTarget.get(SKIP_VOTE_ID);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-amber-300/10 bg-amber-300/[.035] p-5 sm:p-6">
        <p className="eyebrow">OYLAMA SONUCU</p>
        <h2 className="mt-2 text-xl font-semibold">Kasabanın oyları</h2>
        <p className="mt-1 text-sm text-mist">Her oyuncunun aldığı toplam oy aşağıda gösteriliyor.</p>
      </div>
      <div className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">
        {players.map((player) => {
          const result = tallyByTarget.get(player.id);
          const voterIds = result?.voterIds ?? [];
          const count = result?.count ?? 0;
          return (
            <div key={player.id} className={`rounded-2xl border p-3 ${player.isAlive ? "border-white/[.07] bg-white/[.025]" : "border-rose-400/15 bg-rose-950/20"}`}>
              <div className="flex items-center gap-3">
                <span className={`avatar h-9 w-9 shrink-0 text-[10px] font-bold ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : ""}`}>
                  {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <CircleX size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${!player.isAlive ? "line-through decoration-rose-400 decoration-2" : ""}`}>{player.nickname}</span>
                  <span className="mt-0.5 block text-[10px] text-mist">{count} oy</span>
                </span>
                <span className="font-display text-xl text-amber-200">{count}</span>
              </div>
              {count > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 border-t border-white/[.05] pt-3">
                  {Array.from({ length: count }, (_, index) => {
                    const voterId = voterIds[index];
                    const voterName = voterId ? playerNameById.get(voterId) : undefined;
                    return (
                      <span
                        key={`${player.id}-${index}`}
                        title={voteVisibility === "PUBLIC" && voterName ? `${voterName} oy verdi` : "Gizli oy"}
                        className="grid h-6 w-6 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 text-[8px] font-black text-amber-200"
                      >
                        {voteVisibility === "PUBLIC" && voterName ? voterName.slice(0, 1).toUpperCase() : <Vote size={11} />}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3 sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.05] text-mist"><SkipForward size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Oylamayı geçenler</span>
              <span className="mt-0.5 block text-[10px] text-mist">{skipTally?.count ?? 0} oy</span>
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              {Array.from({ length: skipTally?.count ?? 0 }, (_, index) => (
                <span key={`skip-${index}`} className="grid h-6 w-6 place-items-center rounded-full border border-white/[.1] bg-white/[.05] text-mist">
                  <Vote size={11} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlayerBoard({
  players,
  currentPlayerId,
  ownerPlayerId,
  revealedRoleByPlayer,
  phase,
  isAlive,
  role
}: {
  players: GamePlayer[];
  currentPlayerId?: string;
  ownerPlayerId: string;
  revealedRoleByPlayer: Map<string, Role>;
  phase: GameState["phase"];
  isAlive: boolean;
  role: Role;
}) {
  const aliveCount = players.filter((player) => player.isAlive).length;
  const phaseMessage =
    !isAlive
      ? "Yaşayanları izle; yalnızca ölüler sohbetinde konuşabilirsin."
      : phase === "NIGHT" && role === "VILLAGER"
        ? "Kasaba uyuyor. Güneşin doğmasını bekle."
        : phase === "ROLE_REVEAL"
          ? "Rolünü üstteki düğmeden güvenli şekilde görüntüleyebilirsin."
          : "Oyuncuları takip et ve tartışma sırasında davranışlarını karşılaştır.";

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/[.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">KASABA</p>
          <h2 className="mt-1 text-lg font-semibold">{aliveCount} kişi hayatta · {players.length - aliveCount} kişi öldü</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-mist sm:text-right">{phaseMessage}</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {players.map((player) => {
          const revealedRole = revealedRoleByPlayer.get(player.id);
          return (
            <article
              key={player.id}
              className={`relative min-h-40 overflow-hidden rounded-2xl border p-4 ${
                player.isAlive
                  ? "border-white/[.08] bg-white/[.03]"
                  : "border-rose-400/20 bg-rose-950/30 text-mist"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`avatar h-16 w-16 text-sm font-black ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : ""}`}>
                  {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <Skull size={27} />}
                </div>
                <div className="flex items-center gap-2">
                  {player.id === ownerPlayerId && <Crown size={15} className="text-amber-300" />}
                  {player.isAlive
                    ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.5)]" />
                    : <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-rose-300">Öldü</span>}
                </div>
              </div>
              <h3 className={`mt-5 truncate text-base font-bold ${!player.isAlive ? "line-through decoration-rose-400 decoration-2" : ""}`}>{player.nickname}</h3>
              <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2">
                {player.id === currentPlayerId && <span className="text-[9px] font-black uppercase tracking-wider text-rose-300">Sen</span>}
                {player.connected === false && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200">Bağlantı koptu</span>}
                {revealedRole && (
                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${revealedRole === "VAMPIRE" ? "bg-rose-500/10 text-rose-300" : revealedRole === "DOCTOR" ? "bg-emerald-500/10 text-emerald-300" : "bg-sky-500/10 text-sky-300"}`}>
                    {roleNames[revealedRole]}
                  </span>
                )}
              </div>
              {!player.isAlive && <DeadCross />}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeadCross() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="absolute left-1/2 top-1/2 h-1 w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] rounded-full bg-rose-500/75 shadow-[0_0_12px_rgba(244,63,94,.35)]" />
      <span className="absolute left-1/2 top-1/2 h-1 w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[35deg] rounded-full bg-rose-500/75 shadow-[0_0_12px_rgba(244,63,94,.35)]" />
    </span>
  );
}
