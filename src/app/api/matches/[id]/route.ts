import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const statoPraticaSchema = z.object({
  statoPratica: z.enum(["CANDIDATA", "AMMESSA", "RESPINTA", "CONTRATTO_ATTIVO"]),
});

/** Aggiorna lo stato di avanzamento (KPI: candidate/ammesse/contratti attivi) di un singolo match prospect↔misura. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = statoPraticaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errori: parsed.error.flatten() }, { status: 400 });
  }

  const match = await prisma.prospectMisuraMatch
    .update({ where: { id: params.id }, data: { statoPratica: parsed.data.statoPratica } })
    .catch(() => null);

  if (!match) return NextResponse.json({ errore: "Match non trovato" }, { status: 404 });
  return NextResponse.json(match);
}
