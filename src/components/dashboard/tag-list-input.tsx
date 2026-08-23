"use client";

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

export function TagListInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [bozza, setBozza] = useState("");

  function aggiungi() {
    const v = bozza.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setBozza("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      aggiungi();
    } else if (e.key === "Backspace" && bozza === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-ink/10 bg-white p-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-md bg-ink/[0.06] px-2 py-0.5 text-xs font-medium text-ink/65"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-ink/40 hover:text-ink/80"
              aria-label={`Rimuovi ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={aggiungi}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-none bg-transparent text-sm outline-none placeholder:text-ink/40"
        />
      </div>
      <p className="mt-1 text-xs text-ink/40">Premi Invio o virgola per aggiungere</p>
    </div>
  );
}
