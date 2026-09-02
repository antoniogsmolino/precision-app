import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Coda di revisione del backoffice (specifica motore bandi, §42): due
 * categorie distinte, mai fuse in un'unica lista indistinta — un bando a
 * bassa confidence e un bando sparito da una fonte richiedono decisioni
 * umane diverse (confermare i dati vs confermare la chiusura).
 */
export async function GET() {
  const [daVerificare, assenti] = await Promise.all([
    prisma.misura.findMany({
      where: { statoPubblicazione: "DA_VERIFICARE" },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { evidenze: { where: { statoVerifica: "NON_SUPPORTATA" }, select: { campo: true, confidence: true } } },
    }),
    prisma.misura.findMany({
      where: { assenzeConsecutive: { gte: 2 } },
      orderBy: { assenzeConsecutive: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({ daVerificare, assenti });
}
