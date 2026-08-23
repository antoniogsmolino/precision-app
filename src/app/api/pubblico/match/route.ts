import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { pivaFormalmenteValida, recuperaDatiAzienda } from "@/lib/integrations/openapi-business";
import { ricalcolaMatchPerProspect } from "@/lib/matching/engine";
import { formatValoreMisura } from "@/lib/misure/valore";
import { inviaEmailMatch } from "@/lib/email/match-email";

export const dynamic = "force-dynamic";

/**
 * Endpoint pubblico (NON dietro login — vedi middleware.ts) del frontend
 * "Finanza Agevolata Match" (Fase 3): dato piva+email di un'azienda,
 * risolve l'anagrafica via openapi.it, la salva/aggiorna come Prospect
 * (così il lead entra anche nel CRM interno, taggato `fonteImport`),
 * ricalcola i match con lo stesso motore a regole della dashboard e
 * restituisce l'elenco — inviandolo anche via email.
 *
 * Fail-open sull'email (vedi inviaEmailMatch): un invio fallito non deve
 * mai impedire di mostrare i risultati già calcolati.
 */
const bodySchema = z.object({
  piva: z.string().min(11),
  email: z.string().email(),
});

const dataFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" });

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ errore: "Partita IVA ed email sono obbligatorie e devono essere valide." }, { status: 400 });
  }

  const { piva, email } = parsed.data;
  if (!pivaFormalmenteValida(piva)) {
    return NextResponse.json({ errore: "La Partita IVA deve essere composta da 11 cifre." }, { status: 400 });
  }

  const esitoRicerca = await recuperaDatiAzienda(piva);
  if (!esitoRicerca.ok) {
    const messaggi: Record<typeof esitoRicerca.motivo, string> = {
      PIVA_NON_TROVATA: "Non abbiamo trovato nessuna azienda con questa Partita IVA. Controlla che sia corretta.",
      ERRORE_API: "Il servizio di verifica Partita IVA non è raggiungibile in questo momento. Riprova tra qualche minuto.",
      NON_CONFIGURATO: "Il servizio di verifica Partita IVA non è ancora configurato.",
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
      email,
    },
    create: {
      ragioneSociale: dati.ragioneSociale,
      piva: dati.piva,
      ateco: dati.ateco,
      regione: dati.regione,
      provincia: dati.provincia,
      fatturato: dati.fatturato,
      numeroDipendenti: dati.numeroDipendenti,
      email,
      fonteImport: "Finanza Agevolata Match (pubblico)",
    },
  });

  await ricalcolaMatchPerProspect(prospect.id);

  const matches = await prisma.prospectMisuraMatch.findMany({
    where: { prospectId: prospect.id },
    include: { misura: true },
    orderBy: { misura: { dataScadenza: "asc" } },
  });

  const misurePerRisposta = matches.map(({ misura }) => ({
    id: misura.id,
    titolo: misura.titolo,
    ente: misura.ente,
    categoria: misura.categoria,
    descrizioneBreve: misura.descrizioneBreve,
    valoreFormattato: formatValoreMisura(misura),
    scadenzaFormattata: dataFmt.format(misura.dataScadenza),
    scadenzaStimata: misura.scadenzaStimata,
    linkFonteUfficiale: misura.linkFonteUfficiale,
  }));

  const { inviata: emailInviata } = await inviaEmailMatch({
    to: email,
    ragioneSociale: dati.ragioneSociale,
    misure: misurePerRisposta.map((m) => ({
      id: m.id,
      titolo: m.titolo,
      ente: m.ente,
      valoreFormattato: m.valoreFormattato,
      scadenzaFormattata: m.scadenzaFormattata,
    })),
  });

  return NextResponse.json({
    azienda: { ragioneSociale: dati.ragioneSociale, ateco: dati.ateco, regione: dati.regione },
    misure: misurePerRisposta,
    emailInviata,
    contatti: {
      telefono: process.env.MOLO_PHONE_NUMBER ?? null,
      bookingUrl: process.env.MOLO_BOOKING_URL ?? null,
    },
  });
}
