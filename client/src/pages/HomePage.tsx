import { ArrowRight, LockKeyhole, MessageCircle, MoonStar, ShieldCheck, Swords, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";

const features = [
  { icon: LockKeyhole, title: "Özel odan, senin kuralların", text: "Davet bağlantını paylaş; oyuncu sayısı ve tüm oyun ayarları sende." },
  { icon: ShieldCheck, title: "Roller gerçekten gizli", text: "Rol dağıtımı yalnızca sunucuda yapılır. Her oyuncu sadece kendi kartını görür." },
  { icon: MessageCircle, title: "Doğru kişiye doğru sohbet", text: "Kasaba, Vampir ve ölü sohbetleri birbirinden güvenli biçimde ayrılır." }
];

export function HomePage() {
  return (
    <PageShell full>
      <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden">
        <div className="hero-grid absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-400/15 bg-rose-500/[.06] px-3 py-1.5 text-xs font-semibold text-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,.8)]" />
              İlk oyun yayında: Vampir Köylü
            </div>
            <h1 className="text-balance font-display text-5xl font-semibold leading-[.98] tracking-tight text-white sm:text-6xl lg:text-[5.3rem]">
              Bu gece kimse <span className="italic text-rose-300">göründüğü</span> gibi değil.
            </h1>
            <p className="mt-7 max-w-xl text-balance text-base leading-7 text-mist sm:text-lg">
              Odanı kur, davet bağlantısını arkadaşlarına gönder ve güneşi kimin göreceğine birlikte karar ver. Hesap yok; yalnızca oyuncu adın ve keskin sezgilerin.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/rooms/create" className="btn-primary justify-center px-6">
                Oda oluştur <ArrowRight size={17} />
              </Link>
              <Link to="/rooms/join" className="btn-secondary justify-center px-6">
                Kodu gir, katıl
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs text-mist">
              <span className="flex items-center gap-2"><UsersRound size={15} className="text-moon" /> 4–16 oyuncu</span>
              <span className="flex items-center gap-2"><MessageCircle size={15} className="text-moon" /> Yazılı sohbet</span>
              <span className="flex items-center gap-2"><Swords size={15} className="text-moon" /> Dengeli veya serbest mod</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="moon-disc absolute -right-12 -top-14 h-64 w-64 rounded-full opacity-90 sm:h-80 sm:w-80" />
            <div className="panel relative mt-20 overflow-hidden">
              <div className="border-b border-white/[.07] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow">ÖZEL ODA</p>
                    <h2 className="mt-2 text-xl font-semibold">Kuzgunların Gecesi</h2>
                  </div>
                  <span className="status-dot status-online">Bekleniyor</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-5">
                {[
                  { label: "Vampir", count: 2, style: "bg-rose-500/10 text-rose-300" },
                  { label: "Köylü", count: 5, style: "bg-sky-500/10 text-sky-300" },
                  { label: "Doktor", count: 1, style: "bg-emerald-500/10 text-emerald-300" }
                ].map((role) => (
                  <div key={role.label} className="rounded-2xl border border-white/[.06] bg-white/[.025] p-3 text-center">
                    <span className={`mx-auto grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${role.style}`}>{role.count}</span>
                    <p className="mt-2 text-xs font-semibold">{role.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-white/[.06] px-5 py-4 text-xs text-mist">
                <span>8 / 10 oyuncu hazır</span>
                <span className="font-semibold text-emerald-300">Dağılım dengeli</span>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-2xl border border-white/[.08] bg-[#171620] p-3 shadow-panel">
              <MoonStar className="text-rose-300" size={19} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.06] bg-white/[.015]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-16 md:grid-cols-3 lg:px-8">
          {features.map((feature, index) => (
            <article key={feature.title} className="relative rounded-3xl border border-white/[.06] bg-white/[.02] p-6">
              <span className="absolute right-5 top-4 font-display text-4xl text-white/[.035]">0{index + 1}</span>
              <feature.icon size={22} className="text-rose-300" />
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-mist">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="panel flex flex-col items-start justify-between gap-8 overflow-hidden p-8 sm:p-10 lg:flex-row lg:items-center">
          <div>
            <p className="eyebrow">MECLİS TOPLANIYOR</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-semibold sm:text-4xl">Bir kod. Bir kasaba. Sayısız şüphe.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-mist">Oyuncu adını seç, odanı oluştur ve tek bağlantıyla bütün arkadaşlarını çağır.</p>
          </div>
          <Link to="/games/vampire-village" className="btn-secondary shrink-0">Kuralları öğren <ArrowRight size={16} /></Link>
        </div>
      </section>
    </PageShell>
  );
}
