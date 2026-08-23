import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eseguiSeed } from "@/lib/setup/seed";

export const dynamic = "force-dynamic";

/**
 * Endpoint di setup iniziale per un ambiente (es. Vercel) raggiungibile solo
 * da fuori il sandbox di sviluppo: crea l'utente team, le fonti di Fase 1 e
 * i dati dimostrativi, poi ricalcola i match. Idempotente — richiamarlo più
 * volte non duplica nulla. Protetto dallo stesso CRON_SECRET usato per lo
 * scan schedulato: visita `/api/setup/seed?secret=...` una volta dopo il
 * primo deploy.
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const risultato = await eseguiSeed(prisma);
  return NextResponse.json(risultato);
}
