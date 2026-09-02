import { NextResponse } from "next/server";
import { scanFontiDovute } from "@/lib/monitoring/engine";
import { ingestFontiDovute } from "@/lib/motore-bandi/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scan manuale di TUTTE le fonti, lanciato dalla dashboard (pulsante
 * "Scansiona tutte ora" in Fonti monitorate) — utile per verificare/
 * calibrare subito dopo un deploy invece di aspettare il primo giro di
 * cron. Se l'esecuzione viene interrotta per limite di durata della
 * piattaforma, quanto già scansionato resta comunque salvato: si può
 * rilanciare per proseguire con le fonti ancora dovute.
 *
 * `forza: true`: un click manuale su questo pulsante è un'azione esplicita
 * del team, diversa dal giro automatico del cron — non ha senso farla
 * rispettare lo stesso limite di 24h tra una scansione e l'altra pensato
 * per non bombardare i siti pubblici in automatico. Senza questo, dopo
 * aver già scansionato tutto una volta, ogni click successivo saltava
 * quasi tutte le fonti come "non ancora dovute" anche quando il team
 * voleva verificare subito l'effetto di una correzione al codice.
 *
 * Include sia le fonti del vecchio motore (parserKey) sia quelle del
 * nuovo motore bandi (adapterKey) — risultati uniti in un solo array,
 * così il frontend (che conta successi/errori/saltate su `risultati`)
 * non ha bisogno di distinguere i due motori.
 */
export async function POST() {
  const [vecchioMotore, motoreBandi] = await Promise.all([
    scanFontiDovute({ forza: true }),
    ingestFontiDovute({ forza: true }),
  ]);
  return NextResponse.json({ eseguitoAlle: new Date().toISOString(), risultati: [...vecchioMotore, ...motoreBandi] });
}
