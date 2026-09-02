import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trovaAziendeCompatibili } from "@/lib/prospecting/engine";
import { leggiStatoBudget, PREZZO_SEARCH_EUR, PREZZO_ADVANCED_EUR, MAX_CANDIDATE_PER_RUN, MAX_ADVANCED_PER_RUN } from "@/lib/prospecting/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET: stato prima di lanciare una ricerca (budget residuo, limiti del
 * run, ultimo run per questa misura) — la UI lo usa per mostrare una
 * stima/conferma prima di spendere soldi veri, mai per avviare da sola.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [budget, ultimoLog] = await Promise.all([
    leggiStatoBudget(),
    prisma.ricercaProspectLog.findFirst({ where: { misuraId: params.id }, orderBy: { avviataAt: "desc" } }),
  ]);

  return NextResponse.json({
    budget,
    prezzi: { search: PREZZO_SEARCH_EUR, advanced: PREZZO_ADVANCED_EUR },
    limiti: { maxCandidatePerRun: MAX_CANDIDATE_PER_RUN, maxAdvancedPerRun: MAX_ADVANCED_PER_RUN },
    stimaCostoMassimoEur: MAX_CANDIDATE_PER_RUN * PREZZO_SEARCH_EUR + MAX_ADVANCED_PER_RUN * PREZZO_ADVANCED_EUR,
    configurato: Boolean(process.env.OPENAPI_IT_API_KEY),
    ultimoRun: ultimoLog,
  });
}

/** POST: lancia davvero la ricerca (azione esplicita dal team, mai automatica). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!process.env.OPENAPI_IT_API_KEY) {
    return NextResponse.json({ errore: "OPENAPI_IT_API_KEY non configurata." }, { status: 400 });
  }

  const misura = await prisma.misura.findUnique({ where: { id: params.id } });
  if (!misura) return NextResponse.json({ errore: "Misura non trovata" }, { status: 404 });

  const risultato = await trovaAziendeCompatibili(params.id);
  return NextResponse.json(risultato);
}
