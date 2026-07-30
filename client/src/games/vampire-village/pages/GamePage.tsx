import { ArrowLeft, Check, Clock3, Crown, Eye, EyeOff, HeartPulse, LoaderCircle, MessageCircle, Moon, Shield, SkipForward, Skull, SlidersHorizontal, Sparkles, Sun, Swords, Target, UsersRound, Volume2, VolumeX, Vote, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "../../../components/ChatPanel";
import { PageShell } from "../../../components/PageShell";
import { VillageAtmosphere, villageModeForGamePhase, type VillageAtmosphereMode } from "../../../components/VillageAtmosphere";
import { useCountdown } from "../../../hooks/useCountdown";
import { useRoomSocket } from "../../../hooks/useRoomSocket";
import { configureGameAudio, playGameSound, unlockGameAudio } from "../../../services/gameAudio";
import { clearRoomSession } from "../../../services/roomSession";
import { emitAck } from "../../../services/socket";
import type { ChatMessage, GamePlayer, GameState, PlayerElimination, Role } from "../../../types";

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
  const { room, game, privateState, elimination, messages, error, session, sendChat, connectionState } = useRoomSocket(code);
  const [selected, setSelected] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [roleVisible, setRoleVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [visibleElimination, setVisibleElimination] = useState<PlayerElimination | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("gece:sound-enabled") !== "false");
  const [soundVolume, setSoundVolume] = useState(() => {
    const storedVolume = Number(localStorage.getItem("gece:sound-volume"));
    return Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100 ? storedVolume : 18;
  });
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const [atmosphereMode, setAtmosphereMode] = useState<VillageAtmosphereMode>("DAY");
  const previousPhaseRef = useRef<GameState["phase"] | null>(null);
  const playedTimeWarningRef = useRef("");
  const seconds = useCountdown(game?.phaseEndsAt, game?.serverNow);
  const gameReady = Boolean(game);
  const desiredAtmosphereMode = game ? villageModeForGamePhase(game.phase) : "DAY";

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
    setRoleVisible(game?.phase === "ROLE_REVEAL");
  }, [game?.phase, game?.round]);

  useEffect(() => {
    const unlock = () => unlockGameAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    configureGameAudio(soundEnabled, soundVolume / 100);
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    if (!gameReady || !game) return;
    if (desiredAtmosphereMode === "DAY") {
      setAtmosphereMode("DAY");
      return;
    }

    setAtmosphereMode((current) => current === "NIGHT" ? current : "SUNSET");
    const nightTransition = window.setTimeout(() => setAtmosphereMode("NIGHT"), 3200);
    return () => window.clearTimeout(nightTransition);
  }, [desiredAtmosphereMode, gameReady]);

  useEffect(() => {
    if (!game) return;
    if (previousPhaseRef.current === null) {
      previousPhaseRef.current = game.phase;
      return;
    }
    if (previousPhaseRef.current === game.phase) return;
    previousPhaseRef.current = game.phase;

    let creatureTimeout: number | undefined;
    if (game.phase === "NIGHT") {
      playGameSound("NIGHT_START");
      creatureTimeout = window.setTimeout(() => playGameSound("NIGHT_CREATURE"), 1700);
    } else if (game.phase === "DAY_DISCUSSION") {
      playGameSound("DAY_START");
    } else if (game.phase === "DAY_VOTING") {
      playGameSound("VOTING_START");
    } else if (game.phase === "ROUND_RESULT") {
      playGameSound("VOTING_END");
    } else if (game.phase === "FINISHED") {
      playGameSound(game.winner === "VILLAGE" ? "VILLAGE_VICTORY" : "VAMPIRE_VICTORY");
    }

    return () => {
      if (creatureTimeout) window.clearTimeout(creatureTimeout);
    };
  }, [game?.phase, game?.winner]);

  useEffect(() => {
    const isWarningPhase = game?.phase === "DAY_DISCUSSION" || game?.phase === "DAY_VOTING";
    if (!game?.phaseEndsAt || !isWarningPhase || seconds <= 0 || seconds > 10) return;
    const warningKey = `${game.round}:${game.phase}:${game.phaseEndsAt}`;
    if (playedTimeWarningRef.current === warningKey) return;
    playedTimeWarningRef.current = warningKey;
    playGameSound("TIME_WARNING");
  }, [game?.phase, game?.phaseEndsAt, game?.round, seconds]);

  useEffect(() => {
    if (!elimination) return;
    setVisibleElimination(elimination);
    try {
      playGameSound(
        elimination.cause === "VAMPIRE"
          ? "VAMPIRE_ATTACK"
          : elimination.cause === "VOTE"
            ? "VOTE_EXECUTION"
            : "PLAYER_ELIMINATED"
      );
    } catch {
      // The visual effect still works when the browser blocks audio playback.
    }
    const timeout = window.setTimeout(() => setVisibleElimination(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [elimination?.id]);

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem("gece:sound-enabled", String(next));
      return next;
    });
  };

  const updateSoundVolume = (volume: number) => {
    setSoundVolume(volume);
    localStorage.setItem("gece:sound-volume", String(volume));
  };

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
  const votedPlayerIds = new Set(game.votedPlayerIds ?? game.publicVotes.map(({ voterId }) => voterId));
  const lastVoteTally = game.lastVoteTally ?? [];
  const showVoteResult = (game.phase === "ROUND_RESULT" || game.phase === "FINISHED") && lastVoteTally.length > 0;
  const votingProgress = Math.min(100, Math.max(0, (seconds / Math.max(1, room.settings.votingSeconds)) * 100));
  const votingTimerTone = seconds <= 10 ? "critical" : votingProgress <= 35 ? "warning" : "normal";
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <PageShell full>
      <VillageAtmosphere mode={atmosphereMode} />
      <div className="game-stage village-game-stage relative z-10 mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1760px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <Moon className="game-watermark game-watermark-moon" aria-hidden="true" />
      <Swords className="game-watermark game-watermark-swords" aria-hidden="true" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {game.phase === "NIGHT" ? <Moon size={15} className="text-indigo-300" /> : <Sun size={15} className="text-amber-300" />}
            <p className="eyebrow">{game.round}. TUR · {room.name}</p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">{phaseNames[game.phase]}</h1>
        </div>
        <div className="flex items-center gap-3">
          {game.phaseEndsAt && game.phase !== "DAY_VOTING" && (
            <div className="flex items-center gap-3 rounded-2xl border border-gold/[.12] bg-black/25 px-4 py-2.5">
              <Clock3 size={16} className={seconds <= 10 ? "text-rose-300" : "text-mist"} />
              <span className="font-display text-xl tabular-nums">{formattedTime}</span>
            </div>
          )}
          <span className="rounded-xl border border-gold/[.12] bg-black/25 px-3 py-3 text-xs text-gold">{room.code}</span>
        </div>
      </div>

      {game.phase === "DAY_VOTING" && game.phaseEndsAt && (
        <section className={`voting-timer voting-timer-${votingTimerTone} mb-6`} aria-label={`Oylama için kalan süre ${formattedTime}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="voting-timer-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <Vote size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.24em] text-amber-200/70">OYLAMA SÜRESİ</p>
                <p className="mt-1 truncate text-xs text-slate-300">
                  {seconds <= 10 ? "Kararını ver, süre bitiyor." : `${game.votesCast} oyuncu oyunu kullandı.`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Clock3 size={16} />
              <span className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">{formattedTime}</span>
            </div>
          </div>
          <div
            className="voting-timer-track mt-4"
            role="progressbar"
            aria-label="Kalan oylama süresi"
            aria-valuemin={0}
            aria-valuemax={room.settings.votingSeconds}
            aria-valuenow={seconds}
          >
            <span className="voting-timer-fill" style={{ width: `${votingProgress}%` }} />
            <span className="voting-timer-marker left-1/4" />
            <span className="voting-timer-marker left-1/2" />
            <span className="voting-timer-marker left-3/4" />
          </div>
        </section>
      )}

      {connectionState !== "connected" && (
        <div className="mb-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-sm text-amber-100" role="status">
          {connectionState === "reconnecting" || connectionState === "connecting"
            ? "Bağlantı yeniden kuruluyor; oyun eylemleri geçici olarak durduruldu."
            : "Sunucuyla bağlantı kesildi. İnternet bağlantınızı kontrol edin."}
        </div>
      )}

      {game.lastResult && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gold/[.12] bg-gold/[.04] p-4 text-sm text-bone/80">
          <Sparkles size={17} className="shrink-0 text-gold" /> {game.lastResult}
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_3.5rem]">
        <main className="min-w-0 space-y-5">
          <section className={`game-role-strip flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${roleVisible ? myTheme.className : ""}`}>
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
            <section className="game-board-panel overflow-hidden rounded-3xl border">
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {actionCandidates.map((player) => {
                    const unavailable =
                      !player.isAlive ||
                      (canVote && !room.settings.canSelfVote && player.id === session?.playerId) ||
                      (canActAtNight && privateState.role === "VAMPIRE" && player.id === session?.playerId) ||
                      (canActAtNight && privateState.role === "DOCTOR" && !room.settings.doctorCanSelfProtect && player.id === session?.playerId);
                    const voterIds = votersByTarget.get(player.id) ?? [];
                    const hasVoted = votedPlayerIds.has(player.id);
                    return (
                    <button
                      key={player.id}
                      disabled={actionLocked || unavailable}
                      onClick={() => setSelected(player.id)}
                      className={`relative min-h-44 overflow-hidden rounded-2xl border p-5 text-left transition ${
                        !player.isAlive
                          ? "border-rose-300/25 bg-[linear-gradient(145deg,rgba(35,15,22,.88),rgba(9,12,18,.94))]"
                          : selected === player.id
                            ? "border-rose-400/50 bg-rose-500/[.11] shadow-[0_0_0_1px_rgba(251,113,133,.08)]"
                            : "border-white/[.06] bg-white/[.025] hover:border-white/[.14] hover:bg-white/[.04]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`avatar h-16 w-16 shrink-0 rounded-2xl text-sm font-black ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : "border-slate-300/15 bg-slate-300/[.06] text-slate-100"}`}>
                          {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <Skull size={27} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-bold ${!player.isAlive ? "text-slate-300" : ""}`}>{player.nickname}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {player.id === session?.playerId && <span className="text-[9px] font-black uppercase tracking-wider text-rose-300">Sen</span>}
                            {player.id === room.ownerPlayerId && <Crown size={12} className="text-amber-300" />}
                            {canVote && hasVoted && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-200">
                                <Check size={12} strokeWidth={3} /> Oy verdi
                              </span>
                            )}
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
                      {!player.isAlive && <DeadMark />}
                    </button>
                    );
                  })}
                </div>
                {canVote && (
                  <button
                    type="button"
                    disabled={actionLocked}
                    onClick={() => setSelected(SKIP_VOTE_ID)}
                    className={`mt-4 flex min-h-16 w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      selected === SKIP_VOTE_ID
                        ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100 shadow-[0_0_0_1px_rgba(110,231,183,.08)]"
                        : "border-white/[.1] bg-white/[.035] text-mist hover:border-emerald-300/25 hover:bg-emerald-400/[.06] hover:text-white"
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/15 bg-emerald-400/[.08] text-emerald-200">
                      <SkipForward size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">Geç</span>
                      <span className="mt-1 block text-[11px] leading-4 text-mist">Bu tur kimseye oy verme.</span>
                    </span>
                    {selected === SKIP_VOTE_ID && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check size={17} /></span>}
                  </button>
                )}
                {selected && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/[.05] px-3 py-2 text-xs text-rose-100">
                    <Check size={14} className="shrink-0 text-rose-300" />
                    <span><strong>{selected === SKIP_VOTE_ID ? "Geç" : playerNameById.get(selected)}</strong> seçildi. Aşağıdaki düğmeyle kararını onayla.</span>
                  </div>
                )}
                <button className="btn-primary mt-5 w-full justify-center" disabled={!selected || actionLocked} onClick={() => void submitAction()}>
                  {actionAlreadySubmitted ? <><Check size={17} /> Kararın alındı</> : actionPending ? <><LoaderCircle size={17} className="animate-spin" /> Gönderiliyor</> : canVote ? <><Vote size={17} /> {selected === SKIP_VOTE_ID ? "Geç oyu ver" : privateState.currentVote ? "Oyumu güncelle" : "Oyumu gönder"}</> : <><Shield size={17} /> Kararımı gönder</>}
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

        <aside className="xl:sticky xl:top-24">
          <nav className="game-tool-rail flex gap-2 rounded-2xl border border-slate-500/15 bg-[#0a0f18]/90 p-2 shadow-2xl backdrop-blur-xl xl:flex-col" aria-label="Oyun araçları">
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
              className={`btn-icon ${roleVisible ? "border-gold/30 bg-gold/10 text-gold" : ""}`}
              onClick={() => setRoleVisible((visible) => !visible)}
              aria-label={roleVisible ? "Rolü gizle" : "Rolü göster"}
              title={roleVisible ? "Rolü gizle" : "Rolü göster"}
            >
              {roleVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              className={`btn-icon ${soundEnabled ? "text-amber-200" : ""}`}
              onClick={toggleSound}
              aria-label={soundEnabled ? "Oyun sesini kapat" : "Oyun sesini aç"}
              title={soundEnabled ? "Oyun sesini kapat" : "Oyun sesini aç"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className={`btn-icon ${soundPanelOpen ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : ""}`}
              onClick={() => setSoundPanelOpen((open) => !open)}
              aria-label={soundPanelOpen ? "Ses ayarlarını kapat" : "Ses ayarlarını aç"}
              title="Ses seviyesi"
            >
              {soundPanelOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}
            </button>
            <div className="hidden h-px bg-white/[.06] xl:block" />
            <span className="btn-icon pointer-events-none" title={`${game.players.filter((player) => player.isAlive).length} kişi hayatta`}>
              <UsersRound size={18} />
            </span>
          </nav>
        </aside>
      </div>

      {soundPanelOpen && (
        <section className="fixed right-4 top-24 z-[55] w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-500/20 bg-[#090e17]/95 p-5 shadow-[0_25px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:right-20" aria-label="Ses ayarları">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">Atmosfer sesleri</p>
              <p className="mt-1 text-[11px] leading-4 text-mist">Sesli sohbet yok; yalnızca oyun efektleri.</p>
            </div>
            <button className={`btn-icon shrink-0 ${soundEnabled ? "text-amber-200" : ""}`} onClick={toggleSound} aria-label={soundEnabled ? "Sesi kapat" : "Sesi aç"}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
          <label className="mt-5 block" htmlFor="game-sound-volume">
            <span className="flex items-center justify-between text-xs font-semibold text-moon/80">
              <span>Ses seviyesi</span>
              <span className="tabular-nums text-amber-200">%{soundVolume}</span>
            </span>
            <input
              id="game-sound-volume"
              className="mt-3 h-2 w-full cursor-pointer accent-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              type="range"
              min="0"
              max="100"
              step="1"
              value={soundVolume}
              disabled={!soundEnabled}
              onChange={(event) => updateSoundVolume(Number(event.target.value))}
            />
          </label>
          <p className="mt-3 text-[10px] leading-4 text-mist">Tercihin bu cihazda otomatik olarak saklanır. Varsayılan seviye düşüktür.</p>
        </section>
      )}

      {chatOpen && (
        <div className="fixed inset-x-4 bottom-4 top-24 z-50 ml-auto flex max-w-[25rem] flex-col sm:right-6 sm:left-auto sm:w-[25rem]">
          {!privateState.isAlive && (
            <div className="mb-3 rounded-2xl border border-rose-400/20 bg-[#160b10]/95 px-4 py-3 text-xs text-rose-100 shadow-2xl backdrop-blur-xl">
              Bu sohbeti yalnızca ölen oyuncular görebilir.
            </div>
          )}
          <ChatPanel
            className="min-h-0 flex-1 border-slate-500/20 bg-[#090e17]/95 shadow-[0_25px_80px_rgba(0,0,0,.55)]"
            messages={visibleMessages}
            channel={chatChannel}
            disabled={!chatEnabled || connectionState !== "connected"}
            onClose={() => setChatOpen(false)}
            onSend={(message) => sendChat(chatChannel, message)}
          />
        </div>
      )}

      {game.phase === "ROLE_REVEAL" && (
        <OpeningSequenceOverlay
          role={privateState.role}
          roleInfo={privateState.roleInfo}
          seconds={seconds}
        />
      )}

      {visibleElimination && (
        <DeathEffect elimination={visibleElimination} />
      )}

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
      </div>
    </PageShell>
  );
}

function OpeningSequenceOverlay({
  role,
  roleInfo,
  seconds
}: {
  role: Role;
  roleInfo: { name: string; description: string; ability: string; goal: string };
  seconds: number;
}) {
  const [introStarted, setIntroStarted] = useState(false);
  useEffect(() => {
    if (seconds > 0 && seconds <= 3) {
      setIntroStarted(true);
    }
  }, [seconds]);
  const nightIsStarting = introStarted;
  const theme = roleTheme[role];
  const RoleIcon = theme.icon;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#030508]/90 p-5 backdrop-blur-md" role="dialog" aria-live="polite" aria-label={nightIsStarting ? "İlk gece başlıyor" : "Rolün açıklandı"}>
      {nightIsStarting ? (
        <div key="night-intro" className="opening-sequence-card w-full max-w-2xl text-center">
          <span className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-indigo-200/20 bg-indigo-300/[.08] text-indigo-100 shadow-[0_0_80px_rgba(129,140,248,.25)]">
            <Moon size={47} />
          </span>
          <p className="eyebrow mt-7 text-indigo-200">KÖY UYKUYA DALIYOR</p>
          <h2 className="mt-3 font-display text-5xl font-semibold text-white sm:text-7xl">İlk gece başlıyor.</h2>
          <p className="mt-4 text-sm text-slate-300">Kapılar kapanıyor, sokaklar sessizleşiyor.</p>
          <span className="mx-auto mt-7 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-black/35 font-display text-2xl tabular-nums text-indigo-100">
            {seconds}
          </span>
        </div>
      ) : (
        <div key="role-reveal" className={`opening-sequence-card w-full max-w-2xl rounded-3xl border p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-10 ${theme.className}`}>
          <p className="text-[10px] font-black uppercase tracking-[.35em] opacity-70">BU GECEKİ ROLÜN</p>
          <span className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-3xl border border-current/20 bg-black/25">
            <RoleIcon size={44} />
          </span>
          <h2 className="mt-6 font-display text-5xl font-semibold text-white sm:text-7xl">{roleInfo.name}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 opacity-80">{roleInfo.description}</p>
          <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">YETENEĞİN</p>
              <p className="mt-2 text-sm font-semibold text-white">{roleInfo.ability}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">HEDEFİN</p>
              <p className="mt-2 text-sm font-semibold text-white">{roleInfo.goal}</p>
            </div>
          </div>
          <p className="mt-6 text-xs opacity-60">Rolünü aklında tut. İlk gece birazdan başlayacak.</p>
        </div>
      )}
    </div>
  );
}

function DeathEffect({ elimination }: { elimination: PlayerElimination }) {
  const vampireAttack = elimination.cause === "VAMPIRE";
  const voteExecution = elimination.cause === "VOTE";

  return (
    <div className="death-overlay fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-black/75 p-6" role="alert" aria-live="assertive">
      <div className="blood-cloud blood-cloud-one" />
      <div className="blood-cloud blood-cloud-two" />
      {vampireAttack && <div className="death-slash" aria-hidden="true" />}
      <div className="death-message relative z-10 text-center">
        <span className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-rose-300/25 bg-black/55 text-rose-200 shadow-[0_0_70px_rgba(190,18,60,.55)]">
          {vampireAttack ? <Swords size={46} /> : <Skull size={46} />}
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[.38em] text-rose-300">
          {vampireAttack ? "GECE KATLİAMI" : voteExecution ? "KASABANIN KARARI" : "OYUNCU ELENDİ"}
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-white sm:text-6xl">
          {vampireAttack
            ? `${elimination.nickname} dün gece katledildi.`
            : voteExecution
              ? `${elimination.nickname} köyde istenmiyordu.`
              : `${elimination.nickname} artık kasabada değil.`}
        </h2>
        <p className="mt-3 text-sm text-rose-100/65">
          {vampireAttack
            ? "Vampirler gecenin karanlığında yine iz bıraktı."
            : voteExecution
              ? `${elimination.nickname}, kasabanın oylarıyla asıldı.`
              : "Kasaba bir oyuncusunu daha kaybetti."}
        </p>
      </div>
    </div>
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
    <section className="game-board-panel overflow-hidden rounded-3xl border">
      <div className="border-b border-amber-300/10 bg-amber-300/[.035] p-5 sm:p-6">
        <p className="eyebrow">OYLAMA SONUCU</p>
        <h2 className="mt-2 text-xl font-semibold">Kasabanın oyları</h2>
        <p className="mt-1 text-sm text-mist">Her oyuncunun aldığı toplam oy aşağıda gösteriliyor.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        {players.map((player) => {
          const result = tallyByTarget.get(player.id);
          const voterIds = result?.voterIds ?? [];
          const count = result?.count ?? 0;
          return (
            <div key={player.id} className={`min-h-32 rounded-2xl border p-4 ${player.isAlive ? "border-slate-400/10 bg-slate-300/[.035]" : "border-rose-400/20 bg-rose-950/30"}`}>
              <div className="flex items-center gap-3">
                <span className={`avatar h-9 w-9 shrink-0 text-[10px] font-bold ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : ""}`}>
                  {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <Skull size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${!player.isAlive ? "text-slate-300" : ""}`}>{player.nickname}</span>
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
        <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 sm:col-span-2 xl:col-span-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.05] text-mist"><SkipForward size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Geç oyları</span>
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
    <section className="game-board-panel overflow-hidden rounded-3xl border">
      <div className="flex flex-col gap-3 border-b border-white/[.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">KASABA</p>
          <h2 className="mt-1 text-lg font-semibold">{aliveCount} kişi hayatta · {players.length - aliveCount} kişi öldü</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-mist sm:text-right">{phaseMessage}</p>
      </div>
      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {players.map((player) => {
          const revealedRole = revealedRoleByPlayer.get(player.id);
          return (
            <article
              key={player.id}
              className={`player-card relative min-h-52 overflow-hidden rounded-2xl border p-5 ${
                player.isAlive
                  ? "border-slate-400/15 bg-slate-300/[.04]"
                  : "border-rose-300/25 bg-[linear-gradient(145deg,rgba(40,16,24,.84),rgba(8,12,18,.92))] text-mist"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`avatar h-20 w-20 rounded-2xl text-base font-black ${!player.isAlive ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : "border-slate-300/15 bg-slate-300/[.06] text-slate-100"}`}>
                  {player.isAlive ? player.nickname.slice(0, 2).toUpperCase() : <Skull size={32} />}
                </div>
                <div className="flex items-center gap-2">
                  {player.id === ownerPlayerId && <Crown size={15} className="text-amber-300" />}
                  {player.isAlive
                    ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.5)]" />
                    : <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-rose-300">Öldü</span>}
                </div>
              </div>
              <h3 className={`mt-7 truncate text-xl font-bold ${!player.isAlive ? "text-slate-300" : ""}`}>{player.nickname}</h3>
              <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
                {player.id === currentPlayerId && <span className="text-[9px] font-black uppercase tracking-wider text-rose-300">Sen</span>}
                {player.connected === false && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200">Bağlantı koptu</span>}
                {revealedRole && (
                  <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${revealedRole === "VAMPIRE" ? "bg-rose-500/10 text-rose-300" : revealedRole === "DOCTOR" ? "bg-emerald-500/10 text-emerald-300" : "bg-sky-500/10 text-sky-300"}`}>
                    {roleNames[revealedRole]}
                  </span>
                )}
              </div>
              {!player.isAlive && <DeadMark />}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeadMark() {
  return (
    <span className="dead-player-mark pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]" aria-hidden="true">
      <span className="absolute -bottom-8 -right-5 text-rose-100/[.09]">
        <Skull size={126} strokeWidth={1.25} />
      </span>
      <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200/25 bg-[#32121a]/90 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[.16em] text-rose-100 shadow-[0_6px_18px_rgba(0,0,0,.35)]">
        <Skull size={12} /> Elendi
      </span>
      <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-rose-500/65 to-transparent" />
    </span>
  );
}
