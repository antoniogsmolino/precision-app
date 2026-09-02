/**
 * Pannello statistiche persistente della sidebar desktop — secondo dei due
 * rail scuri, sotto forma di griglia 2×2 di tile con puntino colorato +
 * numero grande, sullo stile della reference CRM fornita dal team
 * ("Worklist 6 / New leads 27 / Updates 22 / Assigned 3"), ricolorato
 * sulla palette MOLO reale. Server Component: i conteggi arrivano già
 * calcolati da (dashboard)/layout.tsx, nessun fetch qui.
 */
export interface StatTilesDati {
  misureAperte: number;
  inScadenza: number;
  prospectTotali: number;
  matchDaLavorare: number;
}

const TILES: { chiave: keyof StatTilesDati; label: string; dot: string }[] = [
  { chiave: "misureAperte", label: "Misure aperte", dot: "bg-growth-500" },
  { chiave: "inScadenza", label: "In scadenza", dot: "bg-urgency-500" },
  { chiave: "prospectTotali", label: "Prospect", dot: "bg-navigation-500" },
  { chiave: "matchDaLavorare", label: "Match da lavorare", dot: "bg-brand-500" },
];

export function StatTiles({ dati }: { dati: StatTilesDati }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pt-5">
      {TILES.map((t) => (
        <div key={t.chiave} className="rounded-xl bg-white/[0.06] p-3">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dot}`} />
          <p className="mt-1.5 text-xl font-bold text-white">{dati[t.chiave]}</p>
          <p className="truncate text-[11px] text-white/45">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
