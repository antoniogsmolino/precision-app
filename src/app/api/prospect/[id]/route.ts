import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/validation/prospect";
import { ricalcolaMatchPerProspect } from "@/lib/matching/engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prospect = await prisma.prospect.findUnique({
    where: { id: params.id },
    include: { matches: { include: { misura: true } } },
  });
  if (!prospect) return NextResponse.json({ errore: "Prospect non trovato" }, { status: 404 });
  return NextResponse.json(prospect);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = prospectSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errori: parsed.error.flatten() }, { status: 400 });
  }

  const prospect = await prisma.prospect.update({ where: { id: params.id }, data: parsed.data });
  await ricalcolaMatchPerProspect(prospect.id);

  return NextResponse.json(prospect);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.prospect.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
