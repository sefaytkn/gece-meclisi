import { Crown, ShieldCheck, Signal, SignalLow, Skull, UserRound, X } from "lucide-react";
import type { Room } from "../types";

interface Props {
  room: Room;
  currentPlayerId?: string;
  onKick?: (playerId: string) => void;
}

export function PlayerList({ room, currentPlayerId, onKick }: Props) {
  const isOwner = room.ownerPlayerId === currentPlayerId;
  const emptySeatCount = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4">
        <div>
          <p className="eyebrow">OYUNCULAR</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-emerald-300">{room.players.length} / {room.maxPlayers}</h2>
        </div>
        <span className="status-dot status-online">Canlı oda</span>
      </div>
      <div className="max-h-[34rem] divide-y divide-white/[.05] overflow-y-auto">
        {room.players.map((player) => (
          <div key={player.id} className="group flex min-h-[4.5rem] items-center gap-3 px-5 py-3.5">
            <div className={`avatar ${!player.isAlive ? "avatar-dead" : ""}`}>
              {!player.isAlive ? <Skull size={17} /> : <UserRound size={17} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{player.nickname}</span>
                {player.id === room.ownerPlayerId && <Crown size={14} className="text-amber-300" aria-label="Oda sahibi" />}
                {player.id === currentPlayerId && <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Sen</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-mist">
                {player.isConnected ? <Signal size={12} className="text-emerald-400" /> : <SignalLow size={12} className="text-amber-400" />}
                <span>{player.isConnected ? "Bağlı" : "Yeniden bağlanıyor"}</span>
              </div>
            </div>
            {player.isReady ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <ShieldCheck size={12} /> Hazır
              </span>
            ) : (
              <span className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mist">Bekliyor</span>
            )}
            {isOwner && player.id !== currentPlayerId && onKick && (
              <button className="ml-1 rounded-lg p-1.5 text-mist opacity-0 hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100" onClick={() => onKick(player.id)} aria-label={`${player.nickname} oyuncusunu at`}>
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: emptySeatCount }, (_, index) => (
          <div key={`empty-${index}`} className="flex min-h-[4.5rem] items-center gap-3 px-5 py-3.5 opacity-35">
            <div className="avatar border-dashed"><UserRound size={17} /></div>
            <span className="text-sm font-semibold uppercase tracking-wide text-mist">Boş</span>
          </div>
        ))}
      </div>
    </section>
  );
}
