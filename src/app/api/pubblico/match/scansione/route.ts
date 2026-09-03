import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pivaFormalmenteValida, recuperaDatiAzienda } from "@/lib/integrations/openapi-business";
import { ricalcolaMatchPerProspect } from "@/lib/matching/engine";

export const dynamic = "force-dynamic";

/**
 * Primo passo del flusso pubblico "Finanza Agevolata Match": data SOLO la
 * Partita IVA (nessuna email ancora), risolve l'anagrafica via openapi.it,
 * crea/aggiorna il Prospect e calcola i match — ma restituisce solo il
 * CONTEGGIO delle misure compatibili, mai l'elenco. Serve a mostrare
 * un'anteprima ("Abbiamo trovato N agevolazioni per la tua azienda") prima
 * di chiedere l'email, che sblocca l'elenco completo tramite
 * POST /api/pubblico/match (secondo passo, invariato).
 *
 * Non tocca mai il campo `email` del Prospect: se esiste già (da una
 * ricerca precedente completata) resta intatto; se non esiste resta null
 * finché l'utente non la fornisce nel secondo passo. Chiamare
 * recuperaDatiAzienda due volte (qui e nel passo finale) non genera una
 * seconda spesa Advanced: la cache aziende la intercetta (vedi
 * openapi-business.ts).
 */
const bodySchema = z.object({ piva: z.string().min(11) });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "La Partita IVA è obbligatoria." }, { status: 400 });
  }

  const { piva } = parsed.data;
  if (!pivaFormalmenteValida(piva)) {
    return NextResponse.json({ errore: "La Partita IVA deve essere composta da 11 cifre." }, { status: 400 });
  }

  const esitoRicerca = await recuperaDatiAzienda(piva);
  if (!esitoRicerca.ok) {
    const messaggi: Record<typeof esitoRicerca.motivo, string> = {
      PIVA_NON_TROVATA: "Non abbiamo trovato nessuna azienda con questa Partita IVA. Controlla che sia corretta.",
      ERRORE_API: "Il servizio di verifica Partita IVA non è raggiungibile in questo momento. Riprova tra qualche minuto.",
      NON_CONFIGURATO: "Il servizio di verifica Partita IVA non è ancora configurato.",
      BUDGET_ESAURITO: "Abbiamo raggiunto il limite di verifiche automatiche per oggi. Riprova domani o contattaci direttamente.",
    };
    return NextResponse.json({ errore: messaggi[esitoRicerca.motivo] }, { status: 422 });
  }

  const { dati } = esitoRicerca;

  const prospect = await prisma.prospect.upsert({
    where: { piva: dati.piva },
    update: {
      ragioneSociale: dati.ragioneSociale,
      ateco: dati.ateco,
      regione: dati.regione,
      provincia: dati.provincia,
      fatturato: dati.fatturato,
      numeroDipendenti: dati.numeroDipendenti,
      // Nessuna chiave `email` qui: un valore già raccolto in una ricerca
      // precedente non deve mai essere azzerato da questo passo.
    },
    create: {
      ragioneSociale: dati.ragioneSociale,
      piva: dati.piva,
      ateco: dati.ateco,
      regione: dati.regione,
      provincia: dati.provincia,
      fatturato: dati.fatturato,
      numeroDipendenti: dati.numeroDipendenti,
      fonteImport: "Finanza Agevolata Match (pubblico)",
    },
  });

  await ricalcolaMatchPerProspect(prospect.id);

  const numeroMisureTrovate = await prisma.prospectMisuraMatch.count({ where: { prospectId: prospect.id } });

  return NextResponse.json({
    azienda: {
      ragioneSociale: dati.ragioneSociale,
      ateco: dati.ateco,
      regione: dati.regione,
      provincia: dati.provincia,
      fatturato: dati.fatturato,
      numeroDipendenti: dati.numeroDipendenti,
    },
    numeroMisureTrovate,
    contatti: {
      telefono: process.env.MOLO_PHONE_NUMBER ?? null,
      bookingUrl: process.env.MOLO_BOOKING_URL ?? null,
    },
  });
}
