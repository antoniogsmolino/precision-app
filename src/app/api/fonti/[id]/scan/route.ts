import { NextRequest, NextResponse } from "next/server";
import { scanFonte } from "@/lib/monitoring/engine";

/** Scan manuale di una singola fonte, lanciato dalla dashboard (pulsante "Scansiona ora"). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const risultato = await scanFonte(params.id, { forza: true });
  return NextResponse.json(risultato);
}
