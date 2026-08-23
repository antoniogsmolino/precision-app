"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuori(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAperto(false);
    }
    document.addEventListener("mousedown", onClickFuori);
    return () => document.removeEventListener("mousedown", onClickFuori);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className={clsx(
          "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
          selected.length > 0
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <ChevronIcon className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {aperto && (
        <div className="absolute left-0 top-full z-20 mt-1.5 max-h-72 w-56 max-w-[85vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-card-hover animate-fade-in">
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
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Nessuna opzione</p>}
        </div>
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
