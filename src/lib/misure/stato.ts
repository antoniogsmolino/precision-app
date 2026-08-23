/**
 * Stato di una misura — SEMPRE calcolato da dataApertura/dataScadenza, MAI
 * salvato manualmente. Vedi prisma/schema.prisma per la nota sul modello.
 */
export type StatoMisura = "FUTURA" | "ATTIVA" | "IN_SCADENZA" | "SCADUTA";

export const SOGLIA_IN_SCADENZA_GIORNI = 30;

export const STATO_LABEL: Record<StatoMisura, string> = {
  FUTURA: "Futura",
  ATTIVA: "Attiva",
  IN_SCADENZA: "In scadenza",
  SCADUTA: "Scaduta",
};

/** Colori pensati per essere immediatamente riconoscibili, in linea con
 * la scala `status.*` definita in tailwind.config.ts */
export const STATO_COLOR: Record<StatoMisura, { bg: string; text: string; dot: string; border: string }> = {
  FUTURA: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    border: "border-violet-200",
  },
  ATTIVA: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
  IN_SCADENZA: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  SCADUTA: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    dot: "bg-slate-400",
    border: "border-slate-200",
  },
};

/** Colori pieni (per barre della timeline Gantt, che necessitano contrasto) */
export const STATO_TIMELINE_COLOR: Record<StatoMisura, { bg: string; border: string }> = {
  FUTURA: { bg: "#8B5CF6", border: "#6D28D9" },
  ATTIVA: { bg: "#22C55E", border: "#15803D" },
  IN_SCADENZA: { bg: "#F59E0B", border: "#B45309" },
  SCADUTA: { bg: "#94A3B8", border: "#64748B" },
};

export function calcolaStatoMisura(
  dataApertura: Date,
  dataScadenza: Date,
  now: Date = new Date(),
): StatoMisura {
  const t = now.getTime();
  if (t < dataApertura.getTime()) return "FUTURA";
  if (t > dataScadenza.getTime()) return "SCADUTA";

  const giorniAllaScadenza =
    (dataScadenza.getTime() - t) / (1000 * 60 * 60 * 24);
  if (giorniAllaScadenza <= SOGLIA_IN_SCADENZA_GIORNI) return "IN_SCADENZA";
  return "ATTIVA";
}

export function giorniAllaScadenza(dataScadenza: Date, now: Date = new Date()): number {
  return Math.ceil((dataScadenza.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
