import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const PLAYER_NAME_KEY = "gece-meclisi:player-name";

interface PlayerContextValue {
  nickname: string;
  setNickname: (nickname: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function readNickname() {
  if (typeof window === "undefined") return "";
  return normalizeNickname(window.localStorage.getItem(PLAYER_NAME_KEY) ?? "");
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [nickname, setNicknameState] = useState(readNickname);

  const setNickname = (value: string) => {
    const normalized = normalizeNickname(value);
    setNicknameState(normalized);
    window.localStorage.setItem(PLAYER_NAME_KEY, normalized);
  };

  const contextValue = useMemo(() => ({ nickname, setNickname }), [nickname]);
  return <PlayerContext.Provider value={contextValue}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer yalnızca PlayerProvider içinde kullanılabilir.");
  return context;
}
