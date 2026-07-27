import { ArrowRight, Link2, Settings2, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { usePlayer } from "../context/PlayerContext";
import { saveRoomSession } from "../services/roomSession";
import { connectSocket, emitAck } from "../services/socket";
import type { Room } from "../types";

export function CreateRoomPage() {
  const { nickname } = usePlayer();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const navigate = useNavigate();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");

    try {
      connectSocket(nickname);
      const result = await emitAck<{ room: Room; playerId: string; reconnectToken: string }>("room:create", {
        name: data.get("name"),
        maxPlayers,
        password: ""
      });
      saveRoomSession(result.room, result.playerId, result.reconnectToken, nickname);
      navigate(`/rooms/${result.room.code}/lobby`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Oda oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!nickname) {
    return <Navigate to={`/login?next=${encodeURIComponent("/rooms/create")}`} replace />;
  }

  return (
    <PageShell>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_.62fr]">
        <section>
          <p className="eyebrow">YENİ ODA</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Meclisi sen topla.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-mist">Odanı oluştur, davet bağlantısını kopyala ve arkadaşlarını tek tıkla bekleme odasına çağır.</p>
          <form onSubmit={submit} className="panel mt-8 space-y-5 p-6 sm:p-7">
            <div className="flex items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.025] px-4 py-3">
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <UserRound size={17} className="shrink-0 text-rose-300" />
                <span className="min-w-0"><strong>{nickname}</strong> olarak oynuyorsun</span>
              </span>
              <Link to={`/login?next=${encodeURIComponent("/rooms/create")}`} className="shrink-0 text-xs font-semibold text-rose-300 hover:text-rose-200">Değiştir</Link>
            </div>
            <div>
              <label className="label" htmlFor="name">Oda adı</label>
              <input className="field w-full" id="name" name="name" minLength={3} maxLength={42} required defaultValue="Kuzgunların Gecesi" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0" htmlFor="maxPlayers">Maksimum oyuncu</label>
                <span className="font-display text-xl text-white">{maxPlayers}</span>
              </div>
              <input className="w-full accent-rose-500" id="maxPlayers" type="range" min={4} max={16} value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))} />
              <div className="mt-1 flex justify-between text-[10px] text-mist"><span>4</span><span>16</span></div>
            </div>
            {error && <p className="rounded-xl border border-rose-400/15 bg-rose-500/[.06] p-3 text-sm text-rose-200">{error}</p>}
            <button className="btn-primary w-full justify-center" disabled={submitting}>
              {submitting ? "Oda hazırlanıyor..." : "Odayı oluştur"} <ArrowRight size={16} />
            </button>
          </form>
        </section>
        <aside className="space-y-4 lg:pt-24">
          {[
            { icon: UsersRound, title: "4–16 oyuncu", text: "Oda doluluğunu istediğin zaman artırabilirsin." },
            { icon: Settings2, title: "Ayrıntılı kurallar", text: "Roller, süreler ve eşitlik kuralları lobi içinde." },
            { icon: Link2, title: "Tek bağlantıyla davet", text: "Bağlantıyı kopyala; arkadaşların oda kodu yazmadan doğrudan katılsın." }
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
              <item.icon size={18} className="text-rose-300" />
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-mist">{item.text}</p>
            </div>
          ))}
        </aside>
      </div>
    </PageShell>
  );
}
