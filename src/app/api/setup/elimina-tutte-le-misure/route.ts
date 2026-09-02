import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eliminaTutteLeMisure } from "@/lib/setup/elimina-tutte-le-misure";

export const dynamic = "force-dynamic";

/**
 * Azzeramento totale una tantum (confermato esplicitamente dall'utente):
 * rimuove TUTTE le misure, comprese quelle inserite a mano, e resetta lo
 * stato di scansione di ogni fonte — punto di partenza per la
 * ricostruzione del motore bandi secondo la nuova specifica tecnica.
 * Stesso CRON_SECRET degli altri endpoint di setup.
 *
 * `/api/setup/elimina-tutte-le-misure?secret=...`              -> anteprima
 * `/api/setup/elimina-tutte-le-misure?secret=...&esegui=true`  -> cancella
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const esegui = req.nextUrl.searchParams.get("esegui") === "true";
  const risultato = await eliminaTutteLeMisure(prisma, { esegui });
  return NextResponse.json(risultato);
}
