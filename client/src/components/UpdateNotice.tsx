import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const currentVersion = import.meta.env.VITE_APP_VERSION;

export function UpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (!cancelled && data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // An unreachable version file must never interrupt an active game.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };

    void checkVersion();
    const interval = window.setInterval(() => void checkVersion(), 45_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[120] mx-auto flex w-[min(34rem,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-amber-200/25 bg-[#17130b]/95 p-3 text-amber-50 shadow-[0_18px_70px_rgba(0,0,0,.55)] backdrop-blur-xl" role="status">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-200">
        <RefreshCw size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Yeni sürüm hazır</span>
        <span className="mt-0.5 block text-[11px] text-amber-100/60">Oyunun güncel görünümünü almak için sayfayı yenile.</span>
      </span>
      <button className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-200/15" onClick={() => window.location.reload()}>
        Yenile
      </button>
    </div>
  );
}
