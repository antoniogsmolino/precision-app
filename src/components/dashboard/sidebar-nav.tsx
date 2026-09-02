"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/dashboard", label: "Radar", icon: RadarIcon },
  { href: "/prospect", label: "Prospect", icon: UsersIcon },
  { href: "/fonti", label: "Fonti monitorate", icon: SourceIcon },
];

/**
 * `tono="scuro"`: variante per il secondo rail scuro della sidebar
 * desktop (vedi (dashboard)/layout.tsx) — stessa struttura, colori
 * invertiti per stare sopra il fondo ink invece che sopra il bianco.
 */
export function SidebarNav({ tono = "chiaro" }: { tono?: "chiaro" | "scuro" }) {
  const pathname = usePathname();
  const scuro = tono === "scuro";

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm font-medium",
              "transition-[background-color,color] duration-200 ease-glass",
              // Selezione "piena", non un bordo/tinta sottile (specifica
              // UI, §43: "la card selezionata deve sembrare una card
              // piena" — background pieno, non solo bordo/tinta).
              scuro
                ? active
                  ? "bg-brand-600 text-white shadow-glow"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/90"
                : active
                  ? "bg-brand-600 text-white shadow-glow"
                  : "text-ink/50 hover:bg-ink/[0.06] hover:text-ink/90",
            )}
          >
            <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-white" : scuro ? "text-white/35" : "text-ink/40")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 12 L18 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 14.2c1.8.6 3 2.2 3 4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4" width="18" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="10" width="18" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="16" width="11" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
