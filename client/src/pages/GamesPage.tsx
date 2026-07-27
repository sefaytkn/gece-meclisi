import { ArrowRight, Clock3, LockKeyhole, Sparkles, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";

export function GamesPage() {
  return (
    <PageShell>
      <div className="mb-10 max-w-2xl">
        <p className="eyebrow">OYUN KÜTÜPHANESİ</p>
        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Bu gece ne oynuyoruz?</h1>
        <p className="mt-4 text-base leading-7 text-mist">Her oyun aynı güvenli oda ve sohbet altyapısını paylaşır; kurallar kendi motorunda çalışır.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
        <article className="panel group relative overflow-hidden p-7 sm:p-9">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-600/20 blur-3xl transition group-hover:bg-rose-600/30" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">Oynanabilir</span>
              <Sparkles className="text-rose-300" />
            </div>
            <div className="mt-20 sm:mt-28">
              <p className="eyebrow">SOSYAL ÇIKARIM</p>
              <h2 className="mt-3 font-display text-4xl font-semibold">Vampir Köylü</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-mist">Geceleri saklan, gündüzleri ikna et. Kasaba Vampirleri bulmadan Vampirler çoğunluğu ele geçirebilecek mi?</p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-moon/70">
                <span className="flex items-center gap-2"><UsersRound size={14} /> 4–16 oyuncu</span>
                <span className="flex items-center gap-2"><Clock3 size={14} /> 15–45 dakika</span>
                <span className="flex items-center gap-2"><LockKeyhole size={14} /> Özel oda</span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/rooms/create" className="btn-primary justify-center">Oda oluştur <ArrowRight size={16} /></Link>
                <Link to="/games/vampire-village" className="btn-secondary justify-center">Oyunu incele</Link>
              </div>
            </div>
          </div>
        </article>
        <article className="panel grid min-h-72 place-items-center border-dashed p-8 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.04] text-mist"><Sparkles size={20} /></div>
            <h3 className="mt-4 font-semibold">Yeni oyunlar yakında</h3>
            <p className="mt-2 text-sm leading-6 text-mist">Modüler oyun motoru yeni kasabalar, yeni kurallar ve yeni geceler için hazır.</p>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
