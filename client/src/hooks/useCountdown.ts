import { useEffect, useState } from "react";

export function useCountdown(endsAt?: number | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0);
    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [endsAt]);
  return seconds;
}
