import type { Metadata } from "next";
import { MatchClient } from "./match-client";

export const metadata: Metadata = {
  title: "Finanza Agevolata Match — MOLO 4.0",
  description:
    "Inserisci la Partita IVA della tua azienda: scopri in un minuto quali bandi e incentivi puoi richiedere, in base ai dati reali monitorati da MOLO 4.0.",
};

/**
 * Frontend pubblico "Finanza Agevolata Match" (Fase 3) — nessun login,
 * escluso volutamente dal matcher di middleware.ts. Split server/client:
 * questo file resta un Server Component solo per poter esportare i
 * `metadata` della pagina; tutta l'interattività (form, chiamata API,
 * risultati) sta in match-client.tsx.
 */
export default function FinanzaAgevolataMatchPage() {
  return <MatchClient />;
}
