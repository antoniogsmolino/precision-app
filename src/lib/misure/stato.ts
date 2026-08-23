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

/**
 * Colori pensati per essere immediatamente riconoscibili, sulla palette
 * MOLO 4.0 (vedi src/app/globals.css):
 *  - FUTURA     → navigation (informativo, "in arrivo")
 *  - ATTIVA     → growth (positivo, aperta ora) — testo sempre ink, mai bianco
 *  - IN_SCADENZA→ urgency (un ambra dedicato: il rosso PRIMARY resta riservato
 *                 alle CTA, non va confuso con uno stato di dashboard)
 *  - SCADUTA    → ink neutro e desaturato (chiusa, fuori gioco)
 */
export const STATO_COLOR: Record<StatoMisura, { bg: string; text: string; dot: string; border: string }> = {
  FUTURA: {
    bg: "bg-navigation-50",
    text: "text-navigation-700",
    dot: "bg-navigation-500",
    border: "border-navigation-500/20",
  },
  ATTIVA: {
    bg: "bg-growth-50",
    text: "text-growth-700",
    dot: "bg-growth-500",
    border: "border-growth-500/25",
  },
  IN_SCADENZA: {
    bg: "bg-urgency-50",
    text: "text-urgency-700",
    dot: "bg-urgency-500",
    border: "border-urgency-500/25",
  },
  SCADUTA: {
    bg: "bg-ink/5",
    text: "text-ink/50",
    dot: "bg-ink/35",
    border: "border-ink/10",
  },
};

/** Colori pieni (per barre della timeline Gantt, che necessitano contrasto) */
export const STATO_TIMELINE_COLOR: Record<StatoMisura, { bg: string; border: string }> = {
  FUTURA: { bg: "#198FD9", border: "#0f6da3" },
  ATTIVA: { bg: "#65BD7D", border: "#3f9c59" },
  IN_SCADENZA: { bg: "#F5A623", border: "#c97d0a" },
  SCADUTA: { bg: "#9CA0AA", border: "#6b6e78" },
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
