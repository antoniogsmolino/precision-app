"use client";

import Link from "next/link";
import { calcolaStatoMisura, giorniAllaScadenza } from "@/lib/misure/stato";
import { formatValoreMisura } from "@/lib/misure/valore";

interface MisuraAlert {
  id: string;
  titolo: string;
  ente: string;
  dataApertura: string | Date;
  dataScadenza: string | Date;
  tipoValore: "IMPORTO_FISSO" | "RANGE" | "PERCENTUALE";
  importoFisso?: number | string | null;
  importoMin?: number | string | null;
  importoMax?: number | string | null;
  percentuale?: number | string | null;
  tettoMassimo?: number | string | null;
}

const SOGLIE = [7, 14, 30] as const;

export function AlertScadenze({ misure }: { misure: MisuraAlert[] }) {
  const inScadenza = misure
    .map((m) => ({ misura: m, giorni: giorniAllaScadenza(new Date(m.dataScadenza)) }))
    .filter(({ misura, giorni }) => {
      const stato = calcolaStatoMisura(new Date(misura.dataApertura), new Date(misura.dataScadenza));
      return stato === "IN_SCADENZA" && giorni >= 0;
    })
    .sort((a, b) => a.giorni - b.giorni);

  if (inScadenza.length === 0) return null;

  const conteggi = SOGLIE.map((soglia) => ({
    soglia,
    count: inScadenza.filter((x) => x.giorni <= soglia).length,
  }));

  return (
    <div className="mb-6 rounded-2xl border border-urgency-500/20 bg-urgency-50/60 p-4 animate-fade-in sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-urgency-500 text-white">
            <BellIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[15px] font-semibold text-urgency-700">Scadenze imminenti</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {conteggi.map(({ soglia, count }) => (
            <span
              key={soglia}
              className="rounded-full border border-urgency-500/30 bg-white px-2.5 py-1 text-xs font-medium text-urgency-700"
            >
              {count} entro {soglia}gg
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 divide-y divide-urgency-500/10">
        {inScadenza.slice(0, 6).map(({ misura, giorni }) => (
          <Link
            key={misura.id}
            href={`/misure/${misura.id}`}
            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink/90">{misura.titolo}</p>
              <p className="truncate text-xs text-ink/40">{misura.ente}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[13px] font-medium text-ink/65">{formatValoreMisura(misura)}</span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-semibold " +
                  (giorni <= 7
                    ? "bg-brand-50 text-brand-700"
                    : giorni <= 14
                      ? "bg-urgency-500/15 text-urgency-700"
                      : "bg-urgency-50 text-urgency-700")
                }
              >
                {giorni === 0 ? "scade oggi" : `${giorni}g`}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {inScadenza.length > 6 && (
        <p className="mt-2 text-xs text-urgency-700">+ altre {inScadenza.length - 6} in scadenza</p>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3a5 5 0 0 0-5 5v3.2c0 .6-.2 1.1-.6 1.6L5 15h14l-1.4-2.2c-.4-.5-.6-1-.6-1.6V8a5 5 0 0 0-5-5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
