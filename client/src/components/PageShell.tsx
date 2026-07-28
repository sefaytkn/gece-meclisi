import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Logo } from "./Logo";

export function PageShell({ children, full = false }: { children: ReactNode; full?: boolean }) {
  return (
    <div className="site-shell relative min-h-screen overflow-hidden bg-ink text-bone">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Navbar />
      <main className={full ? "relative z-10" : "relative z-10 mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-16"}>{children}</main>
      {!full && (
        <footer className="relative z-10 border-t border-gold/[.1] bg-black/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-mist sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <Logo />
            <p>Gece uzun. Kararın daha uzun hatırlanacak.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
