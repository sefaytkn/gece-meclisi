import { ArrowRight, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { normalizeNickname, usePlayer } from "../context/PlayerContext";

export function LoginPage() {
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { nickname, setNickname } = usePlayer();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextNickname = normalizeNickname(String(data.get("nickname") ?? ""));

    if (nextNickname.length < 2) {
      setError("Oyuncu adın en az 2 karakter olmalı.");
      return;
    }

    setNickname(nextNickname);
    const requestedPath = params.get("next");
    const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/games";
    navigate(nextPath, { replace: true });
  };

  return (
    <PlayerEntryLayout
      title="Oyuncu adını seç"
      subtitle="Hesap, e-posta ve şifre yok. Arkadaşlarının seni göreceği adı yazman yeterli."
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="nickname">Oyuncu adın</label>
          <div className="relative">
            <UserRound className="absolute left-3.5 top-3.5 text-mist" size={16} />
            <input
              className="field w-full pl-10"
              id="nickname"
              name="nickname"
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={24}
              defaultValue={nickname}
              autoFocus
              placeholder="GeceGezgini"
            />
          </div>
        </div>
        {error && <p className="rounded-xl border border-rose-400/15 bg-rose-500/[.06] p-3 text-sm text-rose-200">{error}</p>}
        <button className="btn-primary w-full justify-center">
          Devam et <ArrowRight size={16} />
        </button>
      </form>
      <p className="mt-5 text-center text-xs leading-5 text-mist">Adın yalnızca bu cihazda hatırlanır; istediğin zaman değiştirebilirsin.</p>
    </PlayerEntryLayout>
  );
}

function PlayerEntryLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-5 py-10 text-white">
      <div className="ambient ambient-one" />
      <div className="absolute left-5 top-5 z-10 sm:left-8 sm:top-8"><Logo /></div>
      <div className="hero-grid absolute inset-0 opacity-60" />
      <div className="panel relative z-10 w-full max-w-md p-6 sm:p-8">
        <p className="eyebrow">GECE MECLİSİ</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-mist">{subtitle}</p>
        <div className="my-7 h-px bg-white/[.07]" />
        {children}
      </div>
    </div>
  );
}
