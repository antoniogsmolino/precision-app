"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";

/**
 * Header + drawer di navigazione per mobile (< md). Su desktop la sidebar
 * fissa in (dashboard)/layout.tsx resta l'unica nav; questo componente si
 * rende invisibile lì (md:hidden) e non interferisce.
 */
export function MobileNav({ nome, email }: { nome?: string | null; email?: string | null }) {
  const [aperto, setAperto] = useState(false);
  const pathname = usePathname();

  // Chiudi il drawer ad ogni cambio pagina (click su una voce di menu).
  useEffect(() => {
    setAperto(false);
  }, [pathname]);

  // Blocca lo scroll del body mentre il drawer è aperto.
  useEffect(() => {
    document.body.style.overflow = aperto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aperto]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            M
          </div>
          <p className="text-sm font-semibold text-slate-900">Radar Finanza</p>
        </div>
        <button
          onClick={() => setAperto(true)}
          aria-label="Apri il menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </header>

      {aperto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 animate-fade-in"
            onClick={() => setAperto(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2.5 px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                  M
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">Radar Finanza</p>
                  <p className="text-[11px] text-slate-400">MOLO 4.0</p>
                </div>
              </div>
              <button
                onClick={() => setAperto(false)}
                aria-label="Chiudi il menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <CloseIcon className="h-4.5 w-4.5" />
              </button>
            </div>

            <SidebarNav />

            <div className="mt-auto border-t border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-700">{nome}</p>
                  <p className="truncate text-xs text-slate-400">{email}</p>
                </div>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
