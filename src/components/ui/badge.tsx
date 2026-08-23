import type { HTMLAttributes } from "react";
import clsx from "clsx";
import { STATO_COLOR, STATO_LABEL, type StatoMisura } from "@/lib/misure/stato";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function StatoBadge({
  stato,
  scadenzaStimata,
  className,
}: {
  stato: StatoMisura;
  /**
   * Quando la scadenza è un segnaposto (nessuna data reale trovata dal
   * parser — vedi Misura.scadenzaStimata), lo stato calcolato risulta
   * quasi sempre "Attiva" per costruzione (apertura = data dello scan,
   * scadenza = apertura + 1 anno, quindi "ora" ci cade sempre in mezzo):
   * mostrarlo con lo stesso badge verde e sicuro di una misura con date
   * vere sarebbe fuorviante. In questo caso si mostra un badge neutro
   * invece dello stato calcolato.
   */
  scadenzaStimata?: boolean;
  className?: string;
}) {
  if (scadenzaStimata) {
    return (
      <Badge className={clsx("border-urgency-500/25 bg-urgency-50 text-urgency-700", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-urgency-500" />
        Stato da verificare
      </Badge>
    );
  }

  const c = STATO_COLOR[stato];
  return (
    <Badge className={clsx(c.bg, c.text, c.border, className)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", c.dot, stato === "IN_SCADENZA" && "animate-pulse")} />
      {STATO_LABEL[stato]}
    </Badge>
  );
}
