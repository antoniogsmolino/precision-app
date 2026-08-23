import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const fonti = await prisma.fonte.findMany({
    include: {
      _count: { select: { misure: true } },
      scanLogs: { orderBy: { avviatoAt: "desc" }, take: 1 },
    },
    orderBy: [{ livello: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(fonti);
}
