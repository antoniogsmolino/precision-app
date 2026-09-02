import { NextRequest, NextResponse } from "next/server";
import { ingestFonte } from "@/lib/motore-bandi/ingest";

/**
 * Ingest manuale di una fonte gestita dal nuovo motore bandi (Fonte con
 * adapterKey impostato), lanciato dalla dashboard — mirror di
 * /api/fonti/[id]/scan per il vecchio motore. Coesistono: una Fonte usa
 * l'uno o l'altro a seconda che abbia parserKey (vecchio) o adapterKey
 * (nuovo) valorizzato.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const risultato = await ingestFonte(params.id, { forza: true });
  return NextResponse.json(risultato);
}

// Un feed Open Data può avere migliaia di record: anche col processing a
// lotti (non più uno-alla-volta) meglio avere margine oltre al default —
// stesso valore già usato per /scan-tutte e per il cron.
export const dynamic = "force-dynamic";
export const maxDuration = 300;
