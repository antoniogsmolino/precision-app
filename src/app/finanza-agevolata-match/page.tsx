import type { Metadata } from "next";
import { MatchClient } from "./match-client";

export const metadata: Metadata = {
  title: "Scopri i tuoi incentivi — MOLO 4.0",
  description:
    "Inserisci la Partita IVA della tua azienda: scopri in un minuto, gratis, quali bandi e incentivi di finanza agevolata puoi richiedere oggi.",
  robots: { index: true, follow: true },
};

/**
 * Landing page pubblica "Scopri i tuoi incentivi" — lead magnet di MOLO 4.0
 * sulla finanza agevolata. Non fa parte di Sonar 4.0: nessun logo Sonar,
 * nessun componente dell'app interna, deliberatamente esclusa dal matcher
 * di autenticazione (vedi middleware.ts) così da restare pubblica anche
 * quando la dashboard verrà messa dietro login. Split server/client solo
 * per poter esportare `metadata`; l'intera esperienza interattiva vive in
 * match-client.tsx.
 */
export default function FinanzaAgevolataMatchPage() {
  return <MatchClient />;
}
