import { Minus, Plus, Scale, TriangleAlert } from "lucide-react";
import type { RoomSettings, RoleValidation } from "../types";

interface Props {
  settings: RoomSettings;
  validation: RoleValidation;
  disabled?: boolean;
  playerCount: number;
  onChange: (settings: RoomSettings) => void;
}

const roles = [
  { key: "vampires", label: "Vampir", icon: "V", color: "text-rose-300 bg-rose-500/10 border-rose-400/20" },
  { key: "villagers", label: "Köylü", icon: "K", color: "text-sky-300 bg-sky-500/10 border-sky-400/20" },
  { key: "doctors", label: "Doktor", icon: "D", color: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20" }
] as const;

export function RoleSettings({ settings, validation, disabled, playerCount, onChange }: Props) {
  const updateRole = (key: keyof RoomSettings["roles"], delta: number) => {
    const next = Math.max(0, settings.roles[key] + delta);
    onChange({ ...settings, roles: { ...settings.roles, [key]: next } });
  };

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">ROL DAĞILIMI</p>
          <h2 className="mt-2 text-xl font-semibold">Kimler bu gece kasabada?</h2>
          <p className="mt-1 text-sm text-mist">Roller oyun başlarken sunucuda gizlice dağıtılır.</p>
        </div>
        <div className="flex rounded-xl border border-gold/[.12] bg-black/25 p-1">
          {(["BALANCED", "FREE"] as const).map((mode) => (
            <button
              key={mode}
              disabled={disabled}
              onClick={() => onChange({ ...settings, mode })}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${settings.mode === mode ? "bg-gold text-ink" : "text-mist hover:text-bone"}`}
            >
              {mode === "BALANCED" ? "Dengeli" : "Serbest"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {roles.map((role) => (
          <div key={role.key} className="rounded-2xl border border-gold/[.1] bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-black ${role.color}`}>{role.icon}</span>
              <span className="font-semibold">{role.label}</span>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-black/20 p-1.5">
              <button className="stepper" disabled={disabled || settings.roles[role.key] === 0} onClick={() => updateRole(role.key, -1)} aria-label={`${role.label} azalt`}>
                <Minus size={16} />
              </button>
              <span className="font-display text-2xl font-semibold">{settings.roles[role.key]}</span>
              <button className="stepper" disabled={disabled} onClick={() => updateRole(role.key, 1)} aria-label={`${role.label} artır`}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${validation.valid ? "border-emerald-400/15 bg-emerald-400/[.04]" : "border-amber-400/20 bg-amber-400/[.05]"}`}>
        <div className="flex items-center gap-3">
          {validation.valid ? <Scale className="text-emerald-300" size={20} /> : <TriangleAlert className="text-amber-300" size={20} />}
          <div>
            <p className="text-sm font-semibold">{validation.valid ? "Dağılım oyuna hazır" : validation.errors[0]?.message}</p>
            <p className="mt-0.5 text-xs text-mist">
              {validation.selectedTotal} rol seçildi · {playerCount} oyuncu · {validation.difference === 0 ? "Sayılar eşleşiyor" : `${Math.abs(validation.difference)} rol ${validation.difference > 0 ? "eksik" : "fazla"}`}
            </p>
          </div>
        </div>
        {!validation.balanced && settings.mode === "FREE" && <span className="text-xs text-amber-200">Dengesiz dağılım</span>}
      </div>
    </section>
  );
}
