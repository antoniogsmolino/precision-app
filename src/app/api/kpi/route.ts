import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ConteggiStato = { candidate: number; ammesse: number; contrattiAttivi: number; respinte: number };

function conteggiVuoti(): ConteggiStato {
  return { candidate: 0, ammesse: 0, contrattiAttivi: 0, respinte: 0 };
}

function applicaConteggio(c: ConteggiStato, stato: string, count: number) {
  if (stato === "CANDIDATA") c.candidate += count;
  else if (stato === "AMMESSA") c.ammesse += count;
  else if (stato === "CONTRATTO_ATTIVO") c.contrattiAttivi += count;
  else if (stato === "RESPINTA") c.respinte += count;
}

/**
 * KPI del mandato MOLO: aziende candidate / ammesse / contratti attivi,
 * calcolati sia in totale sia per singola misura, a partire dallo
 * `statoPratica` di ogni match Prospect↔Misura (aggiornabile via
 * PATCH /api/matches/[id]).
 */
export async function GET() {
  const [totaliRaw, perMisuraRaw, misure] = await Promise.all([
    prisma.prospectMisuraMatch.groupBy({ by: ["statoPratica"], _count: { _all: true } }),
    prisma.prospectMisuraMatch.groupBy({ by: ["misuraId", "statoPratica"], _count: { _all: true } }),
    prisma.misura.findMany({ select: { id: true, titolo: true } }),
  ]);

  const totali = conteggiVuoti();
  for (const riga of totaliRaw) applicaConteggio(totali, riga.statoPratica, riga._count._all);

  const titoloMisura = new Map(misure.map((m) => [m.id, m.titolo]));
  const perMisuraMappa = new Map<string, ConteggiStato>();
  for (const riga of perMisuraRaw) {
    const conteggi = perMisuraMappa.get(riga.misuraId) ?? conteggiVuoti();
    applicaConteggio(conteggi, riga.statoPratica, riga._count._all);
    perMisuraMappa.set(riga.misuraId, conteggi);
  }

  const perMisura = [...perMisuraMappa.entries()]
    .map(([misuraId, conteggi]) => ({ misuraId, titolo: titoloMisura.get(misuraId) ?? "—", ...conteggi }))
    .sort((a, b) => b.candidate + b.ammesse + b.contrattiAttivi - (a.candidate + a.ammesse + a.contrattiAttivi));

  return NextResponse.json({ totali, perMisura });
}
