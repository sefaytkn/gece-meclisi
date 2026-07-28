import { ArrowRight, KeyRound, Link2, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { normalizeNickname, usePlayer } from "../context/PlayerContext";
import { saveRoomSession } from "../services/roomSession";
import { connectSocket, emitAck } from "../services/socket";
import type { Room } from "../types";

export function JoinRoomPage() {
  const { nickname, setNickname } = usePlayer();
  const [params] = useSearchParams();
  const inviteCode = (params.get("code") ?? "").trim().toUpperCase().slice(0, 6);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextNickname = nickname || normalizeNickname(String(data.get("nickname") ?? ""));
    const roomCode = String(data.get("code") ?? "").trim().toUpperCase();

    if (nextNickname.length < 2) {
      setError("Oyuncu adın en az 2 karakter olmalı.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNickname(nextNickname);

    try {
      connectSocket(nextNickname);
      const result = await emitAck<{ room: Room; playerId: string; reconnectToken: string }>("room:join", {
        code: roomCode,
        password: ""
      });
      saveRoomSession(result.room, result.playerId, result.reconnectToken, nextNickname);
      navigate(`/rooms/${result.room.code}/lobby`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Odaya katılınamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-gold/20 bg-blood/15 text-gold shadow-glow">
            {inviteCode ? <Link2 size={22} /> : <KeyRound size={22} />}
          </div>
          <p className="eyebrow mt-5">{inviteCode ? "DAVET BAĞLANTISI" : "ÖZEL ODA"}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold">{inviteCode ? "Arkadaşının odasına katıl." : "Kodu gir, geceye katıl."}</h1>
          <p className="mt-3 text-sm leading-6 text-mist">
            {inviteCode ? "Oda kodun hazır. Oyuncu adını seçip doğrudan bekleme odasına geç." : "Oda sahibinin paylaştığı altı karakterlik kod yeterli."}
          </p>
        </div>
        <form onSubmit={submit} className="panel mt-8 space-y-5 p-6 sm:p-8">
          <div>
            <label className="label" htmlFor="code">Oda kodu</label>
            <input
              className="field h-14 w-full text-center font-display text-2xl uppercase tracking-[.25em]"
              id="code"
              name="code"
              minLength={6}
              maxLength={6}
              required
              defaultValue={inviteCode}
              readOnly={Boolean(inviteCode)}
              placeholder="AB12CD"
            />
          </div>
          {nickname ? (
            <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-4 py-3">
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <UserRound size={17} className="shrink-0 text-gold" />
                <span className="min-w-0"><strong>{nickname}</strong> olarak katılacaksın</span>
              </span>
              <Link to={`/login?next=${encodeURIComponent(`/rooms/join?code=${inviteCode}`)}`} className="shrink-0 text-xs font-semibold text-gold hover:text-bone">Değiştir</Link>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="nickname">Oyuncu adın</label>
              <div className="relative">
                <UserRound className="absolute left-3.5 top-3.5 text-mist" size={15} />
                <input className="field w-full pl-10" id="nickname" name="nickname" autoComplete="nickname" minLength={2} maxLength={24} required autoFocus placeholder="GeceGezgini" />
              </div>
            </div>
          )}
          {error && <p className="rounded-xl border border-rose-400/15 bg-rose-500/[.06] p-3 text-sm text-rose-200">{error}</p>}
          <button className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? "Odaya bağlanılıyor..." : "Odaya katıl"} <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </PageShell>
  );
}
