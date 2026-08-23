import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/validation/prospect";
import { ricalcolaMatchPerProspect } from "@/lib/matching/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const misuraId = req.nextUrl.searchParams.get("misuraId");
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(misuraId ? { matches: { some: { misuraId } } } : {}),
      ...(q
        ? {
            OR: [
              { ragioneSociale: { contains: q, mode: "insensitive" } },
              { piva: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { matches: true } }, matches: { include: { misura: true } } },
    orderBy: { ragioneSociale: "asc" },
  });

  return NextResponse.json(prospects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = prospectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errori: parsed.error.flatten() }, { status: 400 });
  }

  const prospect = await prisma.prospect.create({ data: parsed.data });
  await ricalcolaMatchPerProspect(prospect.id);

  return NextResponse.json(prospect, { status: 201 });
}
