import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetMisureAutomatiche } from "@/lib/setup/reset-misure-automatiche";

export const dynamic = "force-dynamic";

/**
 * Azzeramento una tantum (su richiesta esplicita del team): rimuove tutte
 * le misure rilevate automaticamente e resetta lo stato di scansione di
 * ogni fonte, per ripartire da zero col motore aggiornato. Mai le misure
 * inserite a mano. Stesso CRON_SECRET degli altri endpoint di setup.
 *
 * `/api/setup/reset-misure-automatiche?secret=...`              -> anteprima
 * `/api/setup/reset-misure-automatiche?secret=...&esegui=true`  -> cancella
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const esegui = req.nextUrl.searchParams.get("esegui") === "true";
  const risultato = await resetMisureAutomatiche(prisma, { esegui });
  return NextResponse.json(risultato);
}
