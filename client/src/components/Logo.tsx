import { MoonStar } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-3" aria-label="Gece Meclisi ana sayfa">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 bg-blood/20 text-gold shadow-glow transition group-hover:scale-105">
        <MoonStar size={20} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-wide text-bone">GECE</span>
          <span className="block text-[9px] font-bold tracking-[.32em] text-gold">MECLİSİ</span>
        </span>
      )}
    </Link>
  );
}
