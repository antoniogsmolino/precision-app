"use client";

import Link from "next/link";
import clsx from "clsx";
import { CardInteractive, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATO_COLOR, calcolaStatoMisura, giorniAllaScadenza, type StatoMisura } from "@/lib/misure/stato";
import { formatValoreMisura, CATEGORIA_LABEL, TIPO_AGEVOLAZIONE_LABEL } from "@/lib/misure/valore";

export interface MisuraCardData {
  id: string;
  titolo: string;
  ente: string;
  categoria: string;
  tipoAgevolazione: string;
  tipoValore: "IMPORTO_FISSO" | "RANGE" | "PERCENTUALE";
  importoFisso?: number | string | null;
  importoMin?: number | string | null;
  importoMax?: number | string | null;
  percentuale?: number | string | null;
  tettoMassimo?: number | string | null;
  dataApertura: string | Date;
  dataScadenza: string | Date;
  scadenzaStimata?: boolean;
  descrizioneBreve: string;
  rilevataAutomaticamente: boolean;
  regioniAmmesse: string[];
  atecoAmmessi: string[];
  atecoEsclusi: string[];
  fonteId?: string | null;
  _count?: { matches: number };
}

/**
 * Pillola di stato "parlante": non solo l'etichetta ("In scadenza") ma il
 * numero di giorni reale, il dato che conta di più quando in radar ci sono
 * centinaia di bandi da scandagliare a colpo d'occhio (richiesta esplicita
 * del team: "il focus deve essere sui bandi trovati... con un impatto
 * visivo di grande effetto"). Per IN_SCADENZA il numero è enorme e nel
 * colore urgency dedicato — mai confuso con il blu PRIMARY del brand.
 */
function PillolaScadenza({
  stato,
  giorni,
  scadenzaStimata,
}: {
  stato: StatoMisura;
  giorni: number;
  scadenzaStimata?: boolean;
}) {
  if (scadenzaStimata) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-urgency-500/25 bg-urgency-50 px-2.5 py-1 text-xs font-semibold text-urgency-700">
        Data da verificare
      </span>
    );
  }

  const c = STATO_COLOR[stato];

  if (stato === "IN_SCADENZA") {
    return (
      <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1", c.bg, c.border)}>
        <span className={clsx("text-[15px] font-extrabold leading-none", c.text)}>{giorni <= 0 ? "0" : giorni}</span>
        <span className={clsx("text-[11px] font-semibold leading-none", c.text)}>{giorni === 1 ? "giorno" : "giorni"}</span>
      </span>
    );
  }

  const testo = stato === "SCADUTA" ? "Scaduta" : stato === "FUTURA" ? "Apre a breve" : "Attiva";
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", c.bg, c.text, c.border)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", c.dot)} />
      {testo}
    </span>
  );
}

export function MisuraCard({ misura }: { misura: MisuraCardData }) {
  const stato = calcolaStatoMisura(new Date(misura.dataApertura), new Date(misura.dataScadenza));
  const giorni = giorniAllaScadenza(new Date(misura.dataScadenza));
  const c = STATO_COLOR[stato];

  const regioni =
    misura.regioniAmmesse.length === 0
      ? null
      : misura.regioniAmmesse.length <= 2
        ? misura.regioniAmmesse.join(", ")
        : `${misura.regioniAmmesse.length} regioni`;

  return (
    <Link href={`/misure/${misura.id}`} className="block h-full">
      <CardInteractive className="relative h-full overflow-hidden">
        {/* Barra di accento sullo stato: lo stesso colore usato nella
            timeline Gantt, riconoscibile anche solo di sfuggita scorrendo
            la griglia. */}
        <span aria-hidden className={clsx("absolute inset-y-0 left-0 w-1.5", c.dot)} />

        <CardBody className="pt-5 pl-[1.625rem]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink/40">{misura.ente}</p>
              <h3 className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-snug text-ink">
                {misura.titolo}
              </h3>
            </div>
            <PillolaScadenza stato={stato} giorni={giorni} scadenzaStimata={misura.scadenzaStimata} />
          </div>

          <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-ink/50">
            {misura.descrizioneBreve}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-ink/10 bg-ink/[0.04] text-ink/70">
              {CATEGORIA_LABEL[misura.categoria]}
            </Badge>
            <Badge className="border-ink/10 bg-ink/[0.04] text-ink/70">
              {TIPO_AGEVOLAZIONE_LABEL[misura.tipoAgevolazione]}
            </Badge>
            {regioni && (
              <Badge className="border-ink/10 bg-ink/[0.04] text-ink/70">{regioni}</Badge>
            )}
            {misura.rilevataAutomaticamente && (
              <Badge className="border-brand-100 bg-brand-50 text-brand-600" title="Rilevata dal monitoraggio automatico">
                Auto
              </Badge>
            )}
          </div>

          <div className="mt-4 border-t border-ink/[0.06] pt-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink/35">Valore</p>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <p className="text-[17px] font-extrabold leading-snug text-ink">{formatValoreMisura(misura)}</p>
              <span className="shrink-0 text-xs text-ink/40">
                {misura.scadenzaStimata
                  ? "scadenza non nota"
                  : stato === "SCADUTA"
                    ? "chiusa"
                    : stato === "FUTURA"
                      ? "apre a breve"
                      : "entro il termine"}
              </span>
            </div>
          </div>

          {misura._count && misura._count.matches > 0 && (
            <p className="mt-2 text-xs font-medium text-brand-600">
              {misura._count.matches} prospect idone{misura._count.matches === 1 ? "o" : "i"} (indicativo)
            </p>
          )}
        </CardBody>
      </CardInteractive>
    </Link>
  );
}
