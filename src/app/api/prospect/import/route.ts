import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prospectSchema } from "@/lib/validation/prospect";
import { ricalcolaMatchPerProspect } from "@/lib/matching/engine";

/**
 * Riceve le righe CSV già mappate lato client (wizard di mappatura colonne,
 * sez. 2) e le salva. Upsert per P.IVA: un secondo import dello stesso file
 * (o di un export più recente) aggiorna i prospect esistenti invece di
 * duplicarli.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const righe = Array.isArray(body?.righe) ? body.righe : [];
  if (righe.length === 0) {
    return NextResponse.json({ errore: "Nessuna riga da importare" }, { status: 400 });
  }

  const risultati = { creati: 0, aggiornati: 0, scartati: 0, erroriRiga: [] as { riga: number; errore: string }[] };

  for (let i = 0; i < righe.length; i++) {
    const parsed = prospectSchema.safeParse(righe[i]);
    if (!parsed.success) {
      risultati.scartati += 1;
      risultati.erroriRiga.push({ riga: i + 1, errore: parsed.error.issues.map((e) => e.message).join("; ") });
      continue;
    }

    const { fonteImport, ...data } = parsed.data;
    const esistente = await prisma.prospect.findUnique({ where: { piva: data.piva } });

    const prospect = await prisma.prospect.upsert({
      where: { piva: data.piva },
      update: { ...data, fonteImport: fonteImport ?? undefined },
      create: { ...data, fonteImport: fonteImport ?? "import CSV" },
    });

    if (esistente) risultati.aggiornati += 1;
    else risultati.creati += 1;

    await ricalcolaMatchPerProspect(prospect.id);
  }

  return NextResponse.json(risultati);
}
