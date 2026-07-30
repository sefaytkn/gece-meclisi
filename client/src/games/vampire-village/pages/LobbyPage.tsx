import { ArrowLeft, Copy, Link2, LoaderCircle, Play, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "../../../components/ChatPanel";
import { PageShell } from "../../../components/PageShell";
import { PlayerList } from "../../../components/PlayerList";
import { RoleSettings } from "../../../components/RoleSettings";
import { VillageAtmosphere } from "../../../components/VillageAtmosphere";
import { useRoomSocket } from "../../../hooks/useRoomSocket";
import { clearRoomSession } from "../../../services/roomSession";
import { emitAck } from "../../../services/socket";
import type { Room, RoomSettings } from "../../../types";

type DurationKey = "nightSeconds" | "discussionSeconds" | "votingSeconds";

const rangeStyle = (value: number, min: number, max: number) =>
  ({ "--range-progress": `${max <= min ? 100 : ((value - min) / (max - min)) * 100}%` }) as CSSProperties;

export function LobbyPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { room, messages, error, session, sendChat, connectionState } = useRoomSocket(code);
  const [actionError, setActionError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState("");
  const [draftMaxPlayers, setDraftMaxPlayers] = useState<number | null>(null);
  const [draftDurations, setDraftDurations] = useState<Record<DurationKey, number> | null>(null);
  const busyRef = useRef(false);
  const activeSliderRef = useRef<string | null>(null);

  const currentPlayer = room?.players.find((player) => player.id === session?.playerId);
  const isOwner = room?.ownerPlayerId === session?.playerId;
  const everyoneReady = Boolean(room?.players.length && room.players.every((player) => player.isReady));
  const inviteUrl = `${window.location.origin}/rooms/join?code=${room?.code ?? code}`;
  const notReadyPlayers = room?.players.filter((player) => !player.isReady) ?? [];
  const startBlockReason =
    connectionState !== "connected"
      ? "Sunucuyla bağlantı kurulmadan oyun başlatılamaz."
      : !room
        ? "Oda bilgileri henüz yükleniyor."
        : room.players.length < 4
          ? `Oyunu başlatmak için en az 4 oyuncu gerekir. Şu anda ${room.players.length} oyuncu var.`
          : !everyoneReady
            ? `Hazır olmayan oyuncular: ${notReadyPlayers.map((player) => player.nickname).join(", ")}.`
            : !room.roleValidation.valid
              ? room.roleValidation.errors[0]?.message ?? "Rol dağılımı oyuncu sayısıyla uyumlu değil."
              : "";

  useEffect(() => {
    if (room?.status === "PLAYING") navigate(`/rooms/${room.code}/game`, { replace: true });
  }, [room?.code, room?.status, navigate]);

  useEffect(() => {
    if (!room || activeSliderRef.current) return;
    setDraftMaxPlayers(room.maxPlayers);
    setDraftDurations({
      nightSeconds: room.settings.nightSeconds,
      discussionSeconds: room.settings.discussionSeconds,
      votingSeconds: room.settings.votingSeconds
    });
  }, [
    room?.maxPlayers,
    room?.settings.nightSeconds,
    room?.settings.discussionSeconds,
    room?.settings.votingSeconds
  ]);

  useEffect(() => {
    setStartError("");
  }, [startBlockReason]);

  const run = async (action: () => Promise<unknown>) => {
    if (busyRef.current || connectionState !== "connected") return;
    busyRef.current = true;
    setBusy(true);
    try {
      setActionError("");
      await action();
    } catch (runError) {
      setActionError(runError instanceof Error ? runError.message : "İşlem tamamlanamadı.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const updateSettings = (settings: RoomSettings) =>
    run(() => emitAck<{ room: Room }>("room:update-settings", { settings }));
  const updateMaxPlayers = (maxPlayers: number) =>
    run(() => emitAck<{ room: Room }>("room:update-settings", { maxPlayers }));

  const commitMaxPlayers = (maxPlayers: number) => {
    activeSliderRef.current = null;
    if (room && maxPlayers !== room.maxPlayers) void updateMaxPlayers(maxPlayers);
  };

  const commitDuration = (key: DurationKey, value: number) => {
    activeSliderRef.current = null;
    if (room && value !== room.settings[key]) void updateSettings({ ...room.settings, [key]: value });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(room?.code ?? code);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1600);
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    window.setTimeout(() => setInviteCopied(false), 2200);
  };

  const leave = async () => {
    await run(async () => {
      await emitAck("room:leave");
      clearRoomSession(code);
      navigate("/");
    });
  };

  const startGame = () => {
    if (startBlockReason) {
      setStartError(startBlockReason);
      return;
    }
    void run(() => emitAck("room:start"));
  };

  if (!room) {
    return (
      <PageShell>
        <VillageAtmosphere mode="DAY" />
        <div className="relative z-10 grid min-h-[60vh] place-items-center">
          <div className="text-center">
            {error ? (
              <>
                <p className="text-rose-300">{error}</p>
                <button className="btn-secondary mt-5" onClick={() => navigate("/rooms/join")}><ArrowLeft size={16} /> Oda koduna dön</button>
              </>
            ) : (
              <>
                <LoaderCircle className="mx-auto animate-spin text-rose-300" />
                <p className="mt-4 text-sm text-mist">Meclise bağlanılıyor...</p>
              </>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <VillageAtmosphere mode="DAY" />
      <div className="relative z-10">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="status-dot status-online">Bekleme odası</span>
            {room.isPrivate && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mist"><ShieldCheck size={12} /> Şifreli</span>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{room.name}</h1>
          <p className="mt-2 text-sm text-mist">Tüm oyuncular hazır olduğunda oda sahibi geceyi başlatabilir.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-gold/[.12] bg-black/25 px-4 py-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-mist">ODA KODU</p>
            <p className="font-display text-lg tracking-[.18em]">{room.code}</p>
          </div>
          <button className="btn-icon" onClick={() => void copyCode()} aria-label="Oda kodunu kopyala">{codeCopied ? <ShieldCheck size={17} className="text-emerald-300" /> : <Copy size={17} />}</button>
        </div>
      </div>

      <section className="panel mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold/[.14] bg-blood/15 text-gold"><Link2 size={19} /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Arkadaşlarını bu odaya davet et</h2>
            <p className="mt-1 truncate text-xs text-mist">{inviteUrl}</p>
          </div>
        </div>
        <button className={`shrink-0 justify-center ${inviteCopied ? "btn-secondary text-emerald-300" : "btn-primary"}`} onClick={() => void copyInvite()}>
          {inviteCopied ? <ShieldCheck size={17} /> : <Copy size={17} />}
          {inviteCopied ? "Bağlantı kopyalandı" : "Davet linkini kopyala"}
        </button>
      </section>

      <section className={`panel mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
        currentPlayer?.isReady ? "border-emerald-400/20 bg-emerald-950/20" : "border-gold/25"
      }`}>
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
            currentPlayer?.isReady
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-gold/10 text-gold shadow-[0_0_28px_rgba(189,165,106,.14)]"
          }`}>
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="text-sm font-bold">{currentPlayer?.isReady ? "Hazırsın, diğer oyuncular bekleniyor." : "Oyuna başlamaya hazır mısın?"}</p>
            <p className="mt-1 text-xs text-mist">Herkes hazır olduğunda oda sahibi geceyi başlatabilir.</p>
          </div>
        </div>
        <button
          className={`min-h-12 shrink-0 justify-center px-7 ${
            currentPlayer?.isReady
              ? "btn-secondary border-emerald-400/25 text-emerald-200"
              : "inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-600 text-sm font-black text-white shadow-[0_12px_34px_rgba(5,150,105,.3)] transition hover:-translate-y-0.5 hover:bg-emerald-500"
          }`}
          disabled={!currentPlayer || busy || connectionState !== "connected"}
          onClick={() => void run(() => emitAck("room:ready", { ready: !currentPlayer?.isReady }))}
        >
          <ShieldCheck size={18} /> {currentPlayer?.isReady ? "Hazır durumunu geri al" : "HAZIRIM"}
        </button>
      </section>

      {connectionState !== "connected" && (
        <div className="mb-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.05] p-4 text-sm text-amber-100" role="status">
          {connectionState === "reconnecting" || connectionState === "connecting"
            ? "Bağlantı yeniden kuruluyor; oda işlemleri geçici olarak durduruldu."
            : "Sunucuyla bağlantı kesildi. İnternet bağlantınızı kontrol edin."}
        </div>
      )}

      {(actionError || room.roleValidation.warnings[0]) && (
        <div className={`mb-5 rounded-2xl border p-4 text-sm ${actionError ? "border-rose-400/15 bg-rose-500/[.06] text-rose-200" : "border-amber-400/15 bg-amber-400/[.05] text-amber-100"}`}>
          {actionError || room.roleValidation.warnings[0]}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[.78fr_1.4fr_.9fr]">
        <div className="space-y-5">
          <PlayerList
            room={room}
            currentPlayerId={session?.playerId}
            onKick={isOwner && !busy ? (targetId) => void run(() => emitAck("room:kick", { targetId })) : undefined}
          />
          <button className="btn-ghost w-full justify-center text-xs" disabled={busy} onClick={() => void leave()}>Odadan ayrıl</button>
        </div>

        <div className="space-y-5">
          <RoleSettings
            settings={room.settings}
            validation={room.roleValidation}
            playerCount={room.players.length}
            disabled={!isOwner || busy || connectionState !== "connected"}
            onChange={(settings) => void updateSettings(settings)}
          />

          <section className="panel overflow-hidden">
            <button className="flex w-full items-center justify-between p-5 text-left" onClick={() => setAdvanced((value) => !value)}>
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold/[.1] bg-gold/[.04] text-gold"><SlidersHorizontal size={17} /></span>
                <span>
                  <span className="block text-sm font-semibold">Gelişmiş oyun kuralları</span>
                  <span className="mt-0.5 block text-xs text-mist">Süreler, koruma ve oylama</span>
                </span>
              </span>
              <Settings2 size={17} className="text-mist" />
            </button>
            {advanced && (
              <div className="grid gap-4 border-t border-gold/[.1] p-5 sm:grid-cols-2">
                <label className="rounded-2xl border border-gold/[.1] bg-black/20 p-4 text-xs text-mist sm:col-span-2">
                  <span className="mb-3 flex items-center justify-between gap-4">
                    <span>
                      <span className="block font-semibold text-white">Oda kapasitesi</span>
                      <span className="mt-1 block text-[10px] leading-4">Odaya katılabilecek en fazla oyuncu sayısı.</span>
                    </span>
                    <span className="rounded-xl border border-gold/15 bg-gold/[.06] px-3 py-1 font-display text-2xl text-gold">
                      {draftMaxPlayers ?? room.maxPlayers}
                    </span>
                  </span>
                  <input
                    className="range-slider w-full"
                    type="range"
                    min={Math.max(4, room.players.length)}
                    max={16}
                    step={1}
                    disabled={!isOwner || busy || connectionState !== "connected"}
                    value={draftMaxPlayers ?? room.maxPlayers}
                    style={rangeStyle(draftMaxPlayers ?? room.maxPlayers, Math.max(4, room.players.length), 16)}
                    onPointerDown={() => { activeSliderRef.current = "maxPlayers"; }}
                    onChange={(event) => setDraftMaxPlayers(Number(event.target.value))}
                    onPointerUp={(event) => commitMaxPlayers(Number(event.currentTarget.value))}
                    onKeyUp={(event) => commitMaxPlayers(Number(event.currentTarget.value))}
                    onBlur={(event) => commitMaxPlayers(Number(event.currentTarget.value))}
                  />
                  <span className="mt-2 flex justify-between text-[10px]">
                    <span>En az {Math.max(4, room.players.length)}</span>
                    <span>En fazla 16</span>
                  </span>
                </label>
                <section className="rounded-2xl border border-gold/[.1] bg-black/20 p-4 sm:col-span-2">
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-bone">Süre ayarları</p>
                    <p className="mt-1 text-[10px] leading-4 text-mist">Çubuğu sürükle; seçtiğin süre bıraktığında kaydedilir.</p>
                  </div>
                  <div className="space-y-6">
                    {([
                      { key: "nightSeconds" as const, label: "Gece süresi", min: 15, max: 180 },
                      { key: "discussionSeconds" as const, label: "Tartışma süresi", min: 15, max: 300 },
                      { key: "votingSeconds" as const, label: "Oylama süresi", min: 15, max: 180 }
                    ]).map((item) => {
                      const value = draftDurations?.[item.key] ?? room.settings[item.key];
                      return (
                        <label key={item.key} className="block text-xs text-mist">
                          <span className="mb-2 flex items-center justify-between gap-4">
                            <span className="font-semibold text-bone">{item.label}</span>
                            <span className="min-w-16 rounded-lg border border-gold/15 bg-gold/[.06] px-2.5 py-1 text-center font-bold tabular-nums text-gold">
                              {value} sn
                            </span>
                          </span>
                          <input
                            className="range-slider w-full"
                            type="range"
                            min={item.min}
                            max={item.max}
                            step={5}
                            disabled={!isOwner || busy || connectionState !== "connected"}
                            value={value}
                            style={rangeStyle(value, item.min, item.max)}
                            onPointerDown={() => { activeSliderRef.current = item.key; }}
                            onChange={(event) => setDraftDurations((current) => ({
                              nightSeconds: current?.nightSeconds ?? room.settings.nightSeconds,
                              discussionSeconds: current?.discussionSeconds ?? room.settings.discussionSeconds,
                              votingSeconds: current?.votingSeconds ?? room.settings.votingSeconds,
                              [item.key]: Number(event.target.value)
                            }))}
                            onPointerUp={(event) => commitDuration(item.key, Number(event.currentTarget.value))}
                            onKeyUp={(event) => commitDuration(item.key, Number(event.currentTarget.value))}
                            onBlur={(event) => commitDuration(item.key, Number(event.currentTarget.value))}
                          />
                          <span className="mt-1 flex justify-between text-[9px] text-mist/70">
                            <span>{item.min} sn</span>
                            <span>{item.max} sn</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
                <label className="flex items-center justify-between rounded-xl border border-white/[.06] p-3 text-xs text-mist">
                  Doktor kendini koruyabilir
                  <input type="checkbox" className="accent-blood" disabled={!isOwner || busy || connectionState !== "connected"} checked={room.settings.doctorCanSelfProtect} onChange={(event) => void updateSettings({ ...room.settings, doctorCanSelfProtect: event.target.checked })} />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/[.06] p-3 text-xs text-mist">
                  Oy değiştirilebilir
                  <input type="checkbox" className="accent-blood" disabled={!isOwner || busy || connectionState !== "connected"} checked={room.settings.canChangeVote} onChange={(event) => void updateSettings({ ...room.settings, canChangeVote: event.target.checked })} />
                </label>
                <fieldset className="rounded-xl border border-white/[.06] p-3 text-xs text-mist">
                  <legend className="px-1">Oylama görünürlüğü</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {[
                      { value: "SECRET" as const, label: "Gizli", description: "Tercihler görünmez" },
                      { value: "PUBLIC" as const, label: "Açık", description: "Oylar görünür" }
                    ].map((option) => {
                      const selected = room.settings.voteVisibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          disabled={!isOwner || busy || connectionState !== "connected"}
                          className={`rounded-xl border p-3 text-left transition disabled:pointer-events-none disabled:opacity-45 ${
                            selected
                              ? "border-gold/35 bg-gold/[.09] text-bone"
                              : "border-gold/[.08] bg-black/20 text-mist hover:border-gold/20 hover:text-bone"
                          }`}
                          onClick={() => void updateSettings({ ...room.settings, voteVisibility: option.value })}
                        >
                          <span className="block font-semibold">{option.label}</span>
                          <span className="mt-1 block text-[10px] leading-4 opacity-70">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/[.06] p-3 text-xs text-mist">
                  <span>
                    <span className="block text-white">Ölüler rolleri görebilir</span>
                    <span className="mt-1 block text-[10px] leading-4">Elenen oyuncular herkesin rolünü görür.</span>
                  </span>
                  <input type="checkbox" className="shrink-0 accent-blood" disabled={!isOwner || busy || connectionState !== "connected"} checked={room.settings.deadCanSeeRoles} onChange={(event) => void updateSettings({ ...room.settings, deadCanSeeRoles: event.target.checked })} />
                </label>
              </div>
            )}
          </section>

          {isOwner && (
            <div>
              <button
                className="btn-primary w-full justify-center py-3"
                disabled={busy}
                onClick={startGame}
                aria-describedby={startBlockReason ? "start-game-reason" : undefined}
              >
                <Play size={17} /> {busy ? "Oyun başlatılıyor..." : "Geceyi başlat"}
              </button>
              {startBlockReason && (
                <p
                  id="start-game-reason"
                  className={`mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5 ${
                    startError
                      ? "border-rose-400/20 bg-rose-500/[.07] text-rose-200"
                      : "border-amber-400/15 bg-amber-400/[.05] text-amber-100"
                  }`}
                  role={startError ? "alert" : "status"}
                >
                  {startError || startBlockReason}
                </p>
              )}
            </div>
          )}
          {!isOwner && <p className="text-center text-xs text-mist">Oyunu oda sahibi başlatacak.</p>}
        </div>

        <div className="self-start xl:sticky xl:top-24">
          <ChatPanel messages={messages} channel="LOBBY" disabled={connectionState !== "connected"} onSend={(message) => sendChat("LOBBY", message)} />
        </div>
      </div>
      </div>
    </PageShell>
  );
}
