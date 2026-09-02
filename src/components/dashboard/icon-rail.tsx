"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { signOut } from "next-auth/react";

/**
 * Rail strettissima solo-icone, primo dei due pannelli scuri della sidebar
 * desktop — struttura ricalcata sulla reference CRM fornita dal team
 * (rail nera con marchio in alto, pulsanti tondi di navigazione, avatar in
 * fondo), ricolorata sulla palette MOLO reale invece di nero/lime.
 */
const LINKS = [
  { href: "/dashboard", label: "Radar", icon: RadarIcon },
  { href: "/prospect", label: "Prospect", icon: UsersIcon },
  { href: "/fonti", label: "Fonti monitorate", icon: SourceIcon },
];

export function IconRail({ nome }: { nome?: string | null }) {
  const pathname = usePathname();
  const iniziali = (nome ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full w-[76px] shrink-0 flex-col items-center gap-2 border-r border-white/[0.06] bg-ink py-5">
      <Link
        href="/dashboard"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] p-2 transition-colors hover:bg-white/[0.14]"
        aria-label="Sonar 4.0 — Radar"
      >
        <Image src="/logo-icon.png" alt="" width={64} height={64} className="h-full w-full" />
      </Link>

      <nav className="flex flex-col gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={clsx(
                "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-200 ease-glass",
                active ? "bg-brand-600 text-white shadow-glow" : "text-white/45 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Esci"
          aria-label="Esci"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.16]"
        >
          {iniziali}
        </button>
      </div>
    </div>
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
