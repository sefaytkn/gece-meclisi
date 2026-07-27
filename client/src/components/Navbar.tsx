import { Menu, Pencil, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext";
import { Logo } from "./Logo";

const navItems = [
  { to: "/games", label: "Oyunlar" },
  { to: "/games/vampire-village", label: "Nasıl oynanır?" }
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { nickname } = usePlayer();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Ana menü">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `text-sm transition ${isActive ? "text-white" : "text-mist hover:text-white"}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {nickname ? (
            <Link to="/login" className="btn-ghost" title="Oyuncu adını değiştir">
              <UserRound size={16} /> {nickname} <Pencil size={13} className="text-mist" />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">Oyuncu adını seç</Link>
          )}
        </div>
        <button
          className="btn-icon md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div id="mobile-navigation" className="border-t border-white/[.06] bg-panel px-5 py-5 md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className="rounded-xl px-4 py-3 text-mist hover:bg-white/5 hover:text-white" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-white/[.06]" />
            {nickname ? (
              <Link to="/login" className="btn-secondary justify-center" onClick={() => setOpen(false)}>
                <UserRound size={16} /> {nickname} · adı değiştir
              </Link>
            ) : (
              <Link to="/login" className="btn-primary justify-center" onClick={() => setOpen(false)}>Oyuncu adını seç</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
