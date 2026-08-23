import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { misuraSchema } from "@/lib/validation/misura";
import { setMisureCumulabili } from "@/lib/misure/cumulabilita";
import { ricalcolaMatchPerMisura } from "@/lib/matching/engine";
import { calcolaStatoMisura } from "@/lib/misure/stato";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const misure = await prisma.misura.findMany({
    include: { fonte: true, _count: { select: { matches: true } } },
    orderBy: { dataScadenza: "asc" },
  });

  const conStato = misure.map((m) => ({ ...m, stato: calcolaStatoMisura(m.dataApertura, m.dataScadenza) }));
  return NextResponse.json(conStato);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = misuraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errori: parsed.error.flatten() }, { status: 400 });
  }

  const { cumulabiliIds, ...data } = parsed.data;

  const misura = await prisma.misura.create({
    data: { ...data, rilevataAutomaticamente: false },
  });

  if (cumulabiliIds.length > 0) {
    await setMisureCumulabili(misura.id, cumulabiliIds);
  }
  await ricalcolaMatchPerMisura(misura.id);

  return NextResponse.json(misura, { status: 201 });
}
