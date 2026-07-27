import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";

export function NotFoundPage() {
  return (
    <PageShell>
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div>
          <p className="font-display text-8xl text-white/[.06]">404</p>
          <p className="eyebrow mt-[-1rem]">YANLIŞ SOKAK</p>
          <h1 className="mt-4 font-display text-4xl font-semibold">Bu ev çoktan terk edilmiş.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-mist">Aradığın sayfa bulunamadı. Gün doğmadan kasabanın merkezine dön.</p>
          <Link to="/" className="btn-primary mt-7"><ArrowLeft size={16} /> Ana sayfaya dön</Link>
        </div>
      </div>
    </PageShell>
  );
}
