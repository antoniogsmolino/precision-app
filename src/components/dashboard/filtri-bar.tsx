"use client";

import { MultiSelectFilter } from "./multi-select-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ITALIA_REGIONI } from "@/lib/validation/misura";
import { CATEGORIA_LABEL, TIPO_AGEVOLAZIONE_LABEL } from "@/lib/misure/valore";
import { STATO_LABEL } from "@/lib/misure/stato";
import { FONTE_MANUALE_ID, haFiltriAttivi, FILTRI_VUOTI, type FiltriMisure } from "@/lib/misure/filtri";

export function FiltriBar({
  filtri,
  onChange,
  fontiDisponibili,
}: {
  filtri: FiltriMisure;
  onChange: (f: FiltriMisure) => void;
  fontiDisponibili: { id: string; nome: string }[];
}) {
  function set<K extends keyof FiltriMisure>(chiave: K, valore: FiltriMisure[K]) {
    onChange({ ...filtri, [chiave]: valore });
  }

  const opzioniFonte = [
    ...fontiDisponibili.map((f) => ({ value: f.id, label: f.nome })),
    { value: FONTE_MANUALE_ID, label: "Inserimento manuale" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-6 py-3.5">
      <MultiSelectFilter
        label="Regione"
        options={ITALIA_REGIONI.map((r) => ({ value: r, label: r }))}
        selected={filtri.regioni}
        onChange={(v) => set("regioni", v)}
      />
      <MultiSelectFilter
        label="Categoria"
        options={Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({ value, label }))}
        selected={filtri.categorie}
        onChange={(v) => set("categorie", v)}
      />
      <MultiSelectFilter
        label="Stato"
        options={Object.entries(STATO_LABEL).map(([value, label]) => ({ value, label }))}
        selected={filtri.stati}
        onChange={(v) => set("stati", v as FiltriMisure["stati"])}
      />
      <MultiSelectFilter
        label="Tipo agevolazione"
        options={Object.entries(TIPO_AGEVOLAZIONE_LABEL).map(([value, label]) => ({ value, label }))}
        selected={filtri.tipiAgevolazione}
        onChange={(v) => set("tipiAgevolazione", v)}
      />
      <MultiSelectFilter
        label="Fonte"
        options={opzioniFonte}
        selected={filtri.fonteIds}
        onChange={(v) => set("fonteIds", v)}
      />

      <Input
        placeholder="Codice ATECO azienda…"
        className="h-9 w-40"
        value={filtri.atecoSettore}
        onChange={(e) => set("atecoSettore", e.target.value)}
      />

      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          placeholder="€ min"
          className="h-9 w-24"
          value={filtri.importoMin ?? ""}
          onChange={(e) => set("importoMin", e.target.value === "" ? null : Number(e.target.value))}
        />
        <span className="text-slate-300">–</span>
        <Input
          type="number"
          placeholder="€ max"
          className="h-9 w-24"
          value={filtri.importoMax ?? ""}
          onChange={(e) => set("importoMax", e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      {haFiltriAttivi(filtri) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(FILTRI_VUOTI)}>
          Azzera filtri
        </Button>
      )}
    </div>
  );
}
