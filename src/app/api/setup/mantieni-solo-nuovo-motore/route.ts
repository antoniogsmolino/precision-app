import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mantieniSoloNuovoMotore } from "@/lib/setup/mantieni-solo-nuovo-motore";

export const dynamic = "force-dynamic";

/**
 * Azione una tantum (su richiesta esplicita del team, 03/09/2026): disattiva
 * ogni Fonte diversa da quella del nuovo motore bandi (adapterKey
 * "incentivi-gov-open-data") e cancella le misure rilevate automaticamente
 * che non vengono da quella fonte — vedi il commento in
 * src/lib/setup/mantieni-solo-nuovo-motore.ts per i dettagli e le garanzie
 * (mai le misure inserite a mano, cascata pulita sui match). Stesso
 * CRON_SECRET degli altri endpoint di setup.
 *
 * `/api/setup/mantieni-solo-nuovo-motore?secret=...`              -> anteprima
 * `/api/setup/mantieni-solo-nuovo-motore?secret=...&esegui=true`  -> applica
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto = req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const esegui = req.nextUrl.searchParams.get("esegui") === "true";
  const risultato = await mantieniSoloNuovoMotore(prisma, { esegui });
  return NextResponse.json(risultato);
}
