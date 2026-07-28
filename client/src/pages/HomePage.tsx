import { ArrowRight, DoorOpen, LockKeyhole, MessageCircle, MoonStar, Plus, ShieldCheck, Swords, UsersRound } from "lucide-react";
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
      <section className="home-hero relative min-h-[calc(100vh-5rem)] overflow-hidden">
        <div className="home-moon" aria-hidden="true" />
        <div className="home-stars" aria-hidden="true" />
        <div className="home-village" aria-hidden="true">
          <svg viewBox="0 0 1440 330" preserveAspectRatio="none">
            <path d="M0 262L88 231L126 194L164 231L226 221L279 169L334 221L388 221L424 185L459 221L523 221L580 144L638 221L700 211L735 172L774 211L833 211L887 157L943 211L1001 211L1044 182L1088 211L1156 211L1210 150L1269 211L1326 221L1375 192L1440 231V330H0Z" />
            <path d="M96 233V198H155V238M258 223V181H306V224M555 223V160H610V224M860 214V169H910V215M1182 213V163H1239V216" />
            <path d="M0 277C188 244 312 285 474 262C639 239 760 286 924 260C1090 234 1248 278 1440 252V330H0Z" />
          </svg>
        </div>
        <div className="home-fog home-fog-one" aria-hidden="true" />
        <div className="home-fog home-fog-two" aria-hidden="true" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1380px] items-center gap-12 px-5 py-14 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-20">
          <div className="home-hero-copy max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bda56a]/25 bg-[#bda56a]/[.07] px-3 py-1.5 text-xs font-semibold text-[#d8c58f]">
              <MoonStar size={14} />
              Çevrim içi Vampir Köylü deneyimi
            </div>
            <p className="mb-3 text-xs font-black uppercase tracking-[.38em] text-[#bda56a]">GECENİN HÜKMÜ BAŞLIYOR</p>
            <h1 className="home-title text-balance font-display text-[4.3rem] font-semibold uppercase leading-[.78] tracking-[-.055em] text-[#eee8dc] sm:text-[6.4rem] lg:text-[8.2rem]">
              Gece <span className="block text-[#8f1d2c]">Meclisi</span>
            </h1>
            <p className="mt-7 font-display text-2xl italic leading-tight text-[#d8c58f] sm:text-3xl">
              “Köy uyurken vampirler avlanır.”
            </p>
            <p className="mt-5 max-w-2xl text-balance text-sm leading-7 text-[#c8c1b5]/75 sm:text-base">
              Arkadaşlarını tek bir odada topla. Roller gizlice dağıtılsın; gece avını seç, gündüz şüphelileri sorgula ve kasabanın kaderini birlikte belirle.
            </p>

            <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">
              <Link
                to="/rooms/create"
                className="group flex min-h-[78px] items-center gap-4 rounded-2xl border border-[#c54a57]/45 bg-[#8f1d2c] px-5 py-4 text-[#fff8eb] shadow-[0_18px_50px_rgba(71,8,18,.48)] transition hover:-translate-y-1 hover:bg-[#a52435]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/20 text-[#e2c77f]"><Plus size={23} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black">Oda oluştur</span>
                  <span className="mt-0.5 block text-xs text-[#ead9cd]/70">Meclisi sen topla</span>
                </span>
                <ArrowRight className="transition group-hover:translate-x-1" size={19} />
              </Link>
              <Link
                to="/rooms/join"
                className="group flex min-h-[78px] items-center gap-4 rounded-2xl border border-[#bda56a]/30 bg-[#0c0b0d]/75 px-5 py-4 text-[#eee8dc] shadow-[0_16px_45px_rgba(0,0,0,.36)] backdrop-blur-md transition hover:-translate-y-1 hover:border-[#d8c58f]/55 hover:bg-[#171216]/90"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#bda56a]/20 bg-[#bda56a]/[.07] text-[#d8c58f]"><DoorOpen size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black">Kodu gir, katıl</span>
                  <span className="mt-0.5 block text-xs text-[#c8c1b5]/65">Seni bekleyen odaya gir</span>
                </span>
                <ArrowRight className="text-[#d8c58f] transition group-hover:translate-x-1" size={19} />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs text-[#c8c1b5]/60">
              <span className="flex items-center gap-2"><UsersRound size={15} className="text-[#bda56a]" /> 4–16 oyuncu</span>
              <span className="flex items-center gap-2"><MessageCircle size={15} className="text-[#bda56a]" /> Yazılı sohbet</span>
              <span className="flex items-center gap-2"><Swords size={15} className="text-[#bda56a]" /> Gizli roller</span>
            </div>
          </div>

          <div className="home-night-card relative mx-auto hidden w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#bda56a]/15 bg-[#09090b]/70 shadow-[0_35px_100px_rgba(0,0,0,.6)] backdrop-blur-xl lg:block">
              <div className="border-b border-[#bda56a]/10 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#bda56a]">KÖY MEYDANI</p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-[#eee8dc]">Gece çöktü.</h2>
                  </div>
                  <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#c8c1b5]/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8f1d2c] shadow-[0_0_12px_rgba(143,29,44,.9)]" />
                    Vampirler uyandı
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-6">
                {[
                  { label: "Vampir", count: 2, style: "border-[#8f1d2c]/30 bg-[#8f1d2c]/15 text-[#d86a76]" },
                  { label: "Köylü", count: 5, style: "border-[#bda56a]/20 bg-[#bda56a]/[.07] text-[#d8c58f]" },
                  { label: "Doktor", count: 1, style: "border-[#d9d2c4]/15 bg-[#d9d2c4]/[.05] text-[#d9d2c4]" }
                ].map((role) => (
                  <div key={role.label} className={`rounded-2xl border p-4 text-center ${role.style}`}>
                    <span className="font-display text-3xl font-semibold">{role.count}</span>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider">{role.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[#bda56a]/10 px-6 py-4 text-xs text-[#c8c1b5]/60">
                <span>Şafak için karar ver</span>
                <span className="font-semibold text-[#d8c58f]">Kimseye güvenme</span>
              </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#bda56a]/10 bg-[#09090b]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-16 md:grid-cols-3 lg:px-8">
          {features.map((feature, index) => (
            <article key={feature.title} className="relative rounded-3xl border border-[#bda56a]/10 bg-[#121013] p-6">
              <span className="absolute right-5 top-4 font-display text-4xl text-[#bda56a]/10">0{index + 1}</span>
              <feature.icon size={22} className="text-[#bda56a]" />
              <h3 className="mt-5 text-lg font-semibold text-[#eee8dc]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#c8c1b5]/65">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#060607] px-5 py-20 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 overflow-hidden rounded-3xl border border-[#bda56a]/15 bg-[linear-gradient(120deg,#121013,#0b090b)] p-8 shadow-[0_24px_70px_rgba(0,0,0,.35)] sm:p-10 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.26em] text-[#bda56a]">MECLİS TOPLANIYOR</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-semibold text-[#eee8dc] sm:text-4xl">Bir kod. Bir kasaba. Sayısız şüphe.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c8c1b5]/65">Oyuncu adını seç, odanı oluştur ve tek bağlantıyla bütün arkadaşlarını çağır.</p>
          </div>
          <Link to="/games/vampire-village" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#bda56a]/25 bg-[#bda56a]/[.07] px-5 py-2.5 text-sm font-semibold text-[#d8c58f] transition hover:-translate-y-0.5 hover:border-[#d8c58f]/45 hover:bg-[#bda56a]/[.12]">
            Kuralları öğren <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
