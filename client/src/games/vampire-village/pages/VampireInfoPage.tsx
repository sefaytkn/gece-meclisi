import { ArrowRight, Cross, Eye, MessageCircle, Moon, Shield, Skull, Sun, Vote } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../../../components/PageShell";

const roles = [
  { name: "Vampir", icon: Skull, color: "rose", text: "Gece bir hedef seç. Gündüz izini kaybettir. Diğer yaşayanların sayısına ulaşırsan kazanırsın." },
  { name: "Köylü", icon: Sun, color: "sky", text: "Özel gücün yok; ama sesin ve oyun var. Çelişkileri yakala, Vampirleri gün ışığına çıkar." },
  { name: "Doktor", icon: Cross, color: "emerald", text: "Her gece yaşayan birini koru. Doğru tahminin, kasabanın kaderini tek başına değiştirebilir." }
];

const phases = [
  { icon: Eye, title: "Rolünü öğren", text: "Kartın yalnızca sana gösterilir. Oda sahibi bile rolünü göremez." },
  { icon: Moon, title: "Gece karar ver", text: "Vampirler avını, Doktor koruyacağı kişiyi gizlice seçer." },
  { icon: MessageCircle, title: "Gündüz tartış", text: "Hayatta kalanlar ipuçlarını birleştirir, savunmalarını yapar." },
  { icon: Vote, title: "Kasaba oylasın", text: "En çok oy alan oyuncu elenir. Her elemeden sonra kazanan kontrol edilir." }
];

export function VampireInfoPage() {
  return (
    <PageShell>
      <section className="grid items-center gap-12 py-4 lg:grid-cols-[1fr_.72fr] lg:py-10">
        <div>
          <p className="eyebrow">VAMPİR KÖYLÜ</p>
          <h1 className="mt-4 text-balance font-display text-5xl font-semibold leading-none sm:text-6xl">Gün doğduğunda herkes eksik uyanabilir.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-mist">Vampir Köylü; blöf, sezgi ve ikna üzerine kurulu bir sosyal çıkarım oyunudur. Her tur gece ve gündüz arasında ilerler. Kimliğini sakla, takımını zafere taşı.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/rooms/create" className="btn-primary justify-center">Oda oluştur <ArrowRight size={16} /></Link>
            <Link to="/rooms/join" className="btn-secondary justify-center">Odaya katıl</Link>
          </div>
        </div>
        <div className="relative mx-auto grid h-80 w-80 place-items-center">
          <div className="moon-disc h-60 w-60 rounded-full sm:h-72 sm:w-72" />
          <div className="absolute inset-5 rounded-full border border-dashed border-white/[.08]" />
          <div className="absolute bottom-3 left-0 rounded-2xl border border-rose-400/15 bg-panel p-4 shadow-panel">
            <p className="eyebrow">KAZANMA KOŞULU</p>
            <p className="mt-1 text-sm font-semibold">Son Vampiri bul.</p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="max-w-2xl">
          <p className="eyebrow">ROLLER</p>
          <h2 className="mt-3 font-display text-4xl font-semibold">Kasabanın üç yüzü</h2>
        </div>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {roles.map((role) => {
            const palette = role.color === "rose" ? "bg-rose-500/10 text-rose-300 border-rose-400/15" : role.color === "sky" ? "bg-sky-500/10 text-sky-300 border-sky-400/15" : "bg-emerald-500/10 text-emerald-300 border-emerald-400/15";
            return (
              <article key={role.name} className="panel p-6">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl border ${palette}`}><role.icon size={21} /></div>
                <h3 className="mt-5 text-xl font-semibold">{role.name}</h3>
                <p className="mt-2 text-sm leading-6 text-mist">{role.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-20 grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
        <div>
          <p className="eyebrow">BİR TUR NASIL İLERLER?</p>
          <h2 className="mt-3 font-display text-4xl font-semibold">Gece konuşmaz. Karar verir.</h2>
          <p className="mt-4 text-sm leading-6 text-mist">Sayaçlar her aşamayı otomatik ilerletir. Bağlantın koparsa oyun seni hemen silmez; geri dönmen için süre tanır.</p>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.04] p-4 text-sm text-emerald-200">
            <Shield size={18} /> Gizli bilgiler yalnızca yetkili oyunculara gider.
          </div>
        </div>
        <div className="panel divide-y divide-white/[.06] overflow-hidden">
          {phases.map((phase, index) => (
            <div key={phase.title} className="flex gap-4 p-5 sm:p-6">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.04] text-moon"><phase.icon size={18} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gold">0{index + 1}</p>
                <h3 className="mt-1 font-semibold">{phase.title}</h3>
                <p className="mt-1 text-sm leading-6 text-mist">{phase.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
