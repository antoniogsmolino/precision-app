"use client";

import Link from "next/link";
import { CardInteractive, CardBody } from "@/components/ui/card";
import { StatoBadge, Badge } from "@/components/ui/badge";
import { calcolaStatoMisura, giorniAllaScadenza } from "@/lib/misure/stato";
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
  descrizioneBreve: string;
  rilevataAutomaticamente: boolean;
  regioniAmmesse: string[];
  atecoAmmessi: string[];
  atecoEsclusi: string[];
  fonteId?: string | null;
  _count?: { matches: number };
}

export function MisuraCard({ misura }: { misura: MisuraCardData }) {
  const stato = calcolaStatoMisura(new Date(misura.dataApertura), new Date(misura.dataScadenza));
  const giorni = giorniAllaScadenza(new Date(misura.dataScadenza));

  return (
    <Link href={`/misure/${misura.id}`} className="block">
      <CardInteractive className="h-full">
        <CardBody className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink/40">{misura.ente}</p>
              <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
                {misura.titolo}
              </h3>
            </div>
            <StatoBadge stato={stato} className="shrink-0" />
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
            {misura.rilevataAutomaticamente && (
              <Badge className="border-brand-100 bg-brand-50 text-brand-600" title="Rilevata dal monitoraggio automatico">
                Auto
              </Badge>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-ink/[0.06] pt-3">
            <span className="text-[15px] font-semibold text-ink">{formatValoreMisura(misura)}</span>
            <span className="text-xs text-ink/40">
              {stato === "SCADUTA"
                ? "Scaduta"
                : stato === "FUTURA"
                  ? "Apre a breve"
                  : `Scade tra ${giorni}g`}
            </span>
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
