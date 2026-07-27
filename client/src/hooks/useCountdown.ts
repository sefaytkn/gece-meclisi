import { useEffect, useState } from "react";

export function getLocalPhaseEndsAt(endsAt: number, serverNow: number | null | undefined, clientNow: number) {
  return clientNow + Math.max(0, endsAt - (serverNow ?? clientNow));
}

export function useCountdown(endsAt?: number | null, serverNow?: number | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const localEndsAt = endsAt
      ? getLocalPhaseEndsAt(endsAt, serverNow, Date.now())
      : null;
    const update = () => setSeconds(localEndsAt ? Math.max(0, Math.ceil((localEndsAt - Date.now()) / 1000)) : 0);
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [endsAt, serverNow]);
  return seconds;
}
