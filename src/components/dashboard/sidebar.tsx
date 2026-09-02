"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { signOut } from "next-auth/react";
import { StatTiles, type StatTilesDati } from "@/components/dashboard/stat-tiles";

const LINKS = [
  { href: "/dashboard", label: "Radar", icon: RadarIcon },
  { href: "/prospect", label: "Prospect", icon: UsersIcon },
  { href: "/fonti", label: "Fonti monitorate", icon: SourceIcon },
];

const STORAGE_KEY = "sonar4-sidebar-collapsa";

/**
 * Sidebar desktop unica: prima c'erano due rail scuri sempre visibili
 * fianco a fianco (icone strette + pannello largo) che mostravano la
 * stessa navigazione e lo stesso logo due volte — feedback del team:
 * "puoi lasciare semplicemente la versione estesa della sidebar e quando
 * decido di farla collassare diventa invece come è all'estrema sinistra".
 * Ora è un solo componente con due stati: espansa (default, con logo
 * esteso/statistiche/nav con etichette/footer) e collassata (solo icone,
 * come la vecchia IconRail) — passa dall'uno all'altro con il pulsante in
 * alto, stato ricordato in localStorage tra le sessioni.
 */
export function Sidebar({
  nome,
  email,
  statTiles,
}: {
  nome?: string | null;
  email?: string | null;
  statTiles: StatTilesDati;
}) {
  const pathname = usePathname();
  const [collassata, setCollassata] = useState(false);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    try {
      setCollassata(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage non disponibile (privacy mode ecc.): resta espansa.
    }
    setPronta(true);
  }, []);

  function toggle() {
    setCollassata((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignorato: non impedisce comunque il toggle in memoria
      }
      return next;
    });
  }

  const iniziali = (nome ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div
      className={clsx(
        "flex h-full shrink-0 flex-col overflow-hidden bg-ink transition-[width] duration-300 ease-glass",
        // Niente transizione sul primo render: eviterebbe uno "scatto"
        // visibile se localStorage riporta lo stato collassato.
        pronta ? "" : "duration-0",
        collassata ? "w-[76px]" : "w-[280px]",
      )}
    >
      <div className="flex items-center gap-2 p-4">
        <Link
          href="/dashboard"
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-2xl bg-white transition-all",
            collassata ? "h-11 w-11 p-2" : "h-11 flex-1 px-4",
          )}
          aria-label="Sonar 4.0 — Radar"
        >
          {collassata ? (
            <Image src="/logo-icon.png" alt="" width={64} height={64} className="h-full w-full" />
          ) : (
            <Image src="/logo-full.png" alt="Sonar 4.0" width={1600} height={380} className="h-6 w-auto" priority />
          )}
        </Link>

        {!collassata && (
          <button
            onClick={toggle}
            title="Comprimi sidebar"
            aria-label="Comprimi sidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ChevronIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {collassata && (
        <button
          onClick={toggle}
          title="Espandi sidebar"
          aria-label="Espandi sidebar"
          className="mx-auto -mt-1 mb-2 flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <ChevronIcon className="h-4 w-4 rotate-180" />
        </button>
      )}

      {!collassata && <StatTiles dati={statTiles} />}

      <nav className={clsx("mt-5 flex flex-1 flex-col gap-2 border-t border-white/[0.06] pt-3", collassata ? "items-center px-3" : "px-3")}>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collassata ? label : undefined}
              aria-label={label}
              className={clsx(
                "flex items-center font-medium transition-[background-color,color] duration-200 ease-glass",
                collassata ? "h-11 w-11 justify-center rounded-2xl" : "gap-2.5 rounded-full px-3 py-2.5 text-sm",
                // Selezione "piena", non un bordo/tinta sottile (specifica
                // UI, §43: "la card selezionata deve sembrare una card
                // piena" — background pieno, non solo bordo/tinta).
                active ? "bg-brand-600 text-white shadow-glow" : "text-white/50 hover:bg-white/[0.06] hover:text-white/90",
              )}
            >
              <Icon className={clsx("h-4 w-4 shrink-0", collassata && "h-5 w-5", active ? "text-white" : "text-white/35")} />
              {!collassata && label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.06] p-4">
        {collassata ? (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Esci"
            aria-label="Esci"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.16]"
          >
            {iniziali}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white/80">{nome}</p>
              <p className="truncate text-xs text-white/40">{email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/90"
            >
              Esci
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 5 L8 12 L15 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
