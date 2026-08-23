import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pulisciMisureNonPertinenti } from "@/lib/setup/pulisci-misure-non-pertinenti";

export const dynamic = "force-dynamic";

/**
 * Pulizia una tantum delle misure rilevate col filtro di rilevanza troppo
 * permissivo (vedi src/lib/setup/pulisci-misure-non-pertinenti.ts).
 * Protetto dallo stesso CRON_SECRET degli altri endpoint di setup.
 *
 * Per default è SEMPRE un'anteprima (nessuna scrittura): mostra cosa
 * verrebbe rimosso. Aggiungi `&esegui=true` solo dopo aver controllato
 * l'anteprima, per cancellare davvero.
 *
 * `/api/setup/pulisci-misure-non-pertinenti?secret=...`              → anteprima
 * `/api/setup/pulisci-misure-non-pertinenti?secret=...&esegui=true`  → cancella
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const esegui = req.nextUrl.searchParams.get("esegui") === "true";
  const risultato = await pulisciMisureNonPertinenti(prisma, { esegui });
  return NextResponse.json(risultato);
}
