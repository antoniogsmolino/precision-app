import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { misuraSchema } from "@/lib/validation/misura";
import { getMisureCumulabili, setMisureCumulabili } from "@/lib/misure/cumulabilita";
import { ricalcolaMatchPerMisura } from "@/lib/matching/engine";
import { calcolaStatoMisura } from "@/lib/misure/stato";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const misura = await prisma.misura.findUnique({
    where: { id: params.id },
    include: { fonte: true, eventi: { orderBy: { createdAt: "asc" } } },
  });
  if (!misura) return NextResponse.json({ errore: "Misura non trovata" }, { status: 404 });

  const cumulabili = await getMisureCumulabili(params.id);

  return NextResponse.json({
    ...misura,
    stato: calcolaStatoMisura(misura.dataApertura, misura.dataScadenza),
    cumulabili,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = misuraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errori: parsed.error.flatten() }, { status: 400 });
  }

  const { cumulabiliIds, ...data } = parsed.data;

  const misura = await prisma.misura.update({ where: { id: params.id }, data });
  await setMisureCumulabili(params.id, cumulabiliIds);
  await ricalcolaMatchPerMisura(params.id);

  return NextResponse.json(misura);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.misura.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
