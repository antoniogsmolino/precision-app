import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eseguiBackfillScadenzaStimata } from "@/lib/setup/backfill-scadenza-stimata";

export const dynamic = "force-dynamic";

/**
 * Correzione una tantum (idempotente) per le misure rilevate PRIMA
 * dell'introduzione di `Misura.scadenzaStimata`: vedi
 * src/lib/setup/backfill-scadenza-stimata.ts per l'euristica. Stessa
 * protezione dell'endpoint di seed: visita
 * `/api/setup/backfill-scadenza-stimata?secret=...` una volta dopo il
 * deploy di questo fix.
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const risultato = await eseguiBackfillScadenzaStimata(prisma);
  return NextResponse.json(risultato);
}
