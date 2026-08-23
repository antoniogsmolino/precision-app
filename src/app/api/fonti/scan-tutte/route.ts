import { NextResponse } from "next/server";
import { scanFontiDovute } from "@/lib/monitoring/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scan manuale di TUTTE le fonti dovute, lanciato dalla dashboard
 * (pulsante "Scansiona tutte ora" in Fonti monitorate) — utile per
 * verificare/calibrare subito dopo un deploy invece di aspettare il primo
 * giro di cron. Se l'esecuzione viene interrotta per limite di durata
 * della piattaforma, quanto già scansionato resta comunque salvato: si
 * può rilanciare per proseguire con le fonti ancora dovute.
 */
export async function POST() {
  const risultati = await scanFontiDovute();
  return NextResponse.json({ eseguitoAlle: new Date().toISOString(), risultati });
}
