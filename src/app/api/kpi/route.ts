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
 *
 * Attenzione alla differenza tra le due aggregazioni qui sotto: per singola
 * misura un conteggio di RIGHE match è già un conteggio di aziende distinte
 * (il vincolo @@unique([prospectId, misuraId]) garantisce al più un match
 * per coppia azienda-misura). Sul TOTALE invece no: la stessa azienda può
 * avere un match CANDIDATA su decine di misure diverse — sommare le righe
 * la conterebbe una volta per misura, gonfiando "Aziende candidate" ben
 * oltre il numero di aziende realmente in anagrafica. Il totale conta
 * quindi aziende DISTINTE per stato (una stessa azienda con stati diversi
 * su misure diverse compare nel totale di ciascuno stato, ma una sola volta
 * per stato).
 */
export async function GET() {
  const [distintiPerStato, perMisuraRaw, misure] = await Promise.all([
    prisma.prospectMisuraMatch.findMany({
      select: { prospectId: true, statoPratica: true },
      distinct: ["prospectId", "statoPratica"],
    }),
    prisma.prospectMisuraMatch.groupBy({ by: ["misuraId", "statoPratica"], _count: { _all: true } }),
    prisma.misura.findMany({ select: { id: true, titolo: true } }),
  ]);

  const totali = conteggiVuoti();
  for (const riga of distintiPerStato) applicaConteggio(totali, riga.statoPratica, 1);

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
