"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

const LARGHEZZA_PANNELLO_PX = 224; // corrisponde a w-56

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [coord, setCoord] = useState<{ top: number; left: number; width: number } | null>(null);
  const bottoneRef = useRef<HTMLButtonElement>(null);
  const pannelloRef = useRef<HTMLDivElement>(null);

  // Il pannello viene renderizzato in un portal (document.body) invece che
  // come figlio assoluto del bottone: dentro la barra filtri, che su mobile
  // ha overflow-x-auto, la posizione "absolute" verrebbe ritagliata
  // dall'antenato (impostare solo overflow-x forza anche overflow-y ad
  // "auto" per come funziona la spec CSS) — il pannello si apriva ma finiva
  // invisibile/non cliccabile fuori dalla striscia dei pulsanti. Con un
  // portal la posizione dipende solo dalle coordinate del bottone, mai
  // dall'overflow di un contenitore intermedio.
  function posizionaSuBottone() {
    const rect = bottoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - LARGHEZZA_PANNELLO_PX - 8);
    setCoord({ top: rect.bottom + 6, left: Math.max(8, left), width: rect.width });
  }

  function apri() {
    posizionaSuBottone();
    setAperto(true);
  }

  useEffect(() => {
    function onClickFuori(e: MouseEvent) {
      const target = e.target as Node;
      if (bottoneRef.current?.contains(target) || pannelloRef.current?.contains(target)) return;
      setAperto(false);
    }
    document.addEventListener("mousedown", onClickFuori);
    return () => document.removeEventListener("mousedown", onClickFuori);
  }, []);

  useEffect(() => {
    if (!aperto) return;
    // RIPOSIZIONA (non chiude) ad ogni scroll/resize: il pannello è
    // `position: fixed`, quindi le coordinate calcolate all'apertura
    // restano corrette solo finché la pagina non scrolla. Chiudere invece
    // di riposizionare sembrava la scelta più semplice, ma un click sul
    // bottone stesso può generare uno scroll di pagina (il browser porta
    // l'elemento in vista quando riceve il focus) — con "chiudi sullo
    // scroll" il pannello si richiudeva nello stesso istante in cui si
    // apriva, praticamente sempre, rendendolo di fatto non cliccabile.
    window.addEventListener("scroll", posizionaSuBottone, { passive: true });
    window.addEventListener("resize", posizionaSuBottone);
    return () => {
      window.removeEventListener("scroll", posizionaSuBottone);
      window.removeEventListener("resize", posizionaSuBottone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="relative">
      <button
        ref={bottoneRef}
        type="button"
        onClick={() => (aperto ? setAperto(false) : apri())}
        className={clsx(
          "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
          selected.length > 0
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-ink/10 bg-white text-ink/65 hover:border-ink/20",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <ChevronIcon className="h-3.5 w-3.5 text-ink/40" />
      </button>

      {aperto &&
        coord &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={pannelloRef}
            style={{ position: "fixed", top: coord.top, left: coord.left, minWidth: coord.width }}
            className="z-50 max-h-72 w-56 max-w-[85vw] overflow-y-auto rounded-xl border border-ink/10 bg-white p-1.5 shadow-card-hover animate-fade-in"
          >
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                Azzera selezione
              </button>
            )}
            {options.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink/80 hover:bg-ink/[0.03]"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-ink/20 text-brand-600 focus:ring-brand-400"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
            {options.length === 0 && <p className="px-2 py-1.5 text-xs text-ink/40">Nessuna opzione</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
