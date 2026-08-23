import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toCsvValue(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const matches = await prisma.prospectMisuraMatch.findMany({
    where: { misuraId: params.id },
    include: { prospect: true },
    orderBy: { prospect: { ragioneSociale: "asc" } },
  });

  const formato = req.nextUrl.searchParams.get("format");

  if (formato === "csv") {
    const intestazioni = [
      "Ragione sociale",
      "P.IVA",
      "ATECO",
      "Regione",
      "Provincia",
      "Fatturato",
      "Dipendenti",
      "Email",
      "Telefono",
      "Criteri soddisfatti",
    ];
    const righe = matches.map((m) =>
      [
        m.prospect.ragioneSociale,
        m.prospect.piva,
        m.prospect.ateco ?? "",
        m.prospect.regione ?? "",
        m.prospect.provincia ?? "",
        m.prospect.fatturato ?? "",
        m.prospect.numeroDipendenti ?? "",
        m.prospect.email ?? "",
        m.prospect.telefono ?? "",
        m.criteriEsito.join(" | "),
      ]
        .map(toCsvValue)
        .join(","),
    );
    const csv = [intestazioni.join(","), ...righe].join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prospect-idonei-${params.id}.csv"`,
      },
    });
  }

  return NextResponse.json(matches);
}
