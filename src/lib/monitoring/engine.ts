import { prisma } from "@/lib/prisma";
import { risolviParser } from "./parsers/registry";
import { verificaRobotsTxt } from "./robots";
import { hashContenuto } from "./parsers/shared";
import { HEADERS_FETCH, messaggioErroreFetch } from "./http";
import { ricalcolaMatchPerMisura } from "@/lib/matching/engine";
import type { MisuraGrezza } from "./types";
import type { Fonte } from "@prisma/client";

const TIMEOUT_FETCH_MS = 20_000;

export interface EsitoScanFonte {
  fonteId: string;
  nome: string;
  saltata: boolean;
  motivoSalto?: string;
  esito?: "SUCCESSO" | "ERRORE" | "BLOCCATO_ROBOTS";
  misureNuove?: number;
  misureAggiornate?: number;
  errore?: string;
}

function campiRilevantiUguali(a: MisuraGrezza, esistente: {
  titolo: string; dataApertura: Date; dataScadenza: Date; scadenzaStimata: boolean;
  tipoAgevolazione: string; tipoValore: string;
  importoFisso: unknown; importoMin: unknown; importoMax: unknown; percentuale: unknown; tettoMassimo: unknown;
}): boolean {
  return (
    a.titolo === esistente.titolo &&
    a.dataApertura.getTime() === new Date(esistente.dataApertura).getTime() &&
    a.dataScadenza.getTime() === new Date(esistente.dataScadenza).getTime() &&
    (a.scadenzaStimata ?? false) === esistente.scadenzaStimata &&
    a.tipoAgevolazione === esistente.tipoAgevolazione &&
    a.tipoValore === esistente.tipoValore &&
    (a.importoFisso ?? null) === (esistente.importoFisso == null ? null : Number(esistente.importoFisso)) &&
    (a.importoMin ?? null) === (esistente.importoMin == null ? null : Number(esistente.importoMin)) &&
    (a.importoMax ?? null) === (esistente.importoMax == null ? null : Number(esistente.importoMax)) &&
    (a.percentuale ?? null) === (esistente.percentuale == null ? null : Number(esistente.percentuale)) &&
    (a.tettoMassimo ?? null) === (esistente.tettoMassimo == null ? null : Number(esistente.tettoMassimo))
  );
}

/**
 * Esegue lo scan di UNA fonte: robots.txt -> rate limit -> fetch -> parser
 * dedicato -> upsert misure -> ricalcolo match -> log. Non lancia mai
 * eccezioni verso il chiamante: ogni fallimento è catturato e riportato
 * nel risultato + salvato in ScanLog, così un errore su una fonte non
 * interrompe la scansione delle altre.
 */
export async function scanFonte(fonteId: string, opts: { forza?: boolean } = {}): Promise<EsitoScanFonte> {
  const fonte = await prisma.fonte.findUnique({ where: { id: fonteId } });
  if (!fonte) return { fonteId, nome: "(sconosciuta)", saltata: true, motivoSalto: "Fonte non trovata" };

  if (!fonte.attiva) {
    return { fonteId, nome: fonte.nome, saltata: true, motivoSalto: "Fonte disattivata" };
  }

  if (!opts.forza && fonte.ultimaScansioneAt) {
    const prossimaScansioneOk =
      Date.now() - fonte.ultimaScansioneAt.getTime() >= fonte.frequenzaOreScan * 60 * 60 * 1000;
    if (!prossimaScansioneOk) {
      return { fonteId, nome: fonte.nome, saltata: true, motivoSalto: "Non ancora dovuta (rate limit fonte)" };
    }
  }

  const parser = risolviParser(fonte.parserKey);
  if (!parser) {
    await registraLog(fonte, "ERRORE", 0, 0, `Nessun parser registrato per parserKey="${fonte.parserKey}"`);
    return { fonteId, nome: fonte.nome, saltata: false, esito: "ERRORE", errore: "Parser non registrato" };
  }

  const robots = await verificaRobotsTxt(fonte.url);
  if (!robots.consentito) {
    await registraLog(fonte, "BLOCCATO_ROBOTS", 0, 0, robots.motivo);
    return { fonteId, nome: fonte.nome, saltata: false, esito: "BLOCCATO_ROBOTS" };
  }

  try {
    const res = await fetch(fonte.url, {
      headers: HEADERS_FETCH,
      signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} da ${fonte.url}`);
    }
    const html = await res.text();

    const { misure, contenutoGrezzo } = await parser(html, fonte.url);
    const hash = hashContenuto(contenutoGrezzo);

    let nuove = 0;
    let aggiornate = 0;

    for (const grezza of misure) {
      const esistente = await prisma.misura.findUnique({
        where: { fonteId_externalId: { fonteId: fonte.id, externalId: grezza.externalId } },
      });

      if (!esistente) {
        const creata = await prisma.misura.create({
          data: {
            titolo: grezza.titolo,
            ente: grezza.ente,
            categoria: grezza.categoria,
            descrizioneBreve: grezza.descrizioneBreve,
            descrizioneEstesa: grezza.descrizioneEstesa ?? grezza.descrizioneBreve,
            tipoAgevolazione: grezza.tipoAgevolazione,
            tipoValore: grezza.tipoValore,
            importoFisso: grezza.importoFisso ?? null,
            importoMin: grezza.importoMin ?? null,
            importoMax: grezza.importoMax ?? null,
            percentuale: grezza.percentuale ?? null,
            tettoMassimo: grezza.tettoMassimo ?? null,
            dataApertura: grezza.dataApertura,
            dataScadenza: grezza.dataScadenza,
            scadenzaStimata: grezza.scadenzaStimata ?? false,
            atecoAmmessi: grezza.atecoAmmessi ?? [],
            atecoEsclusi: grezza.atecoEsclusi ?? [],
            regioniAmmesse: grezza.regioniAmmesse ?? [],
            fatturatoMin: grezza.fatturatoMin ?? null,
            fatturatoMax: grezza.fatturatoMax ?? null,
            dipendentiMin: grezza.dipendentiMin ?? null,
            dipendentiMax: grezza.dipendentiMax ?? null,
            altriRequisiti: grezza.altriRequisiti ?? null,
            documentiRichiesti: grezza.documentiRichiesti ?? [],
            linkFonteUfficiale: grezza.linkFonteUfficiale,
            rilevataAutomaticamente: true,
            fonteId: fonte.id,
            externalId: grezza.externalId,
          },
        });
        nuove += 1;
        await ricalcolaMatchPerMisura(creata.id);
      } else if (!campiRilevantiUguali(grezza, esistente)) {
        await prisma.misura.update({
          where: { id: esistente.id },
          data: {
            titolo: grezza.titolo,
            dataApertura: grezza.dataApertura,
            dataScadenza: grezza.dataScadenza,
            scadenzaStimata: grezza.scadenzaStimata ?? false,
            tipoAgevolazione: grezza.tipoAgevolazione,
            tipoValore: grezza.tipoValore,
            importoFisso: grezza.importoFisso ?? null,
            importoMin: grezza.importoMin ?? null,
            importoMax: grezza.importoMax ?? null,
            percentuale: grezza.percentuale ?? null,
            tettoMassimo: grezza.tettoMassimo ?? null,
          },
        });
        aggiornate += 1;
        await ricalcolaMatchPerMisura(esistente.id);
      }
    }

    await prisma.fonte.update({
      where: { id: fonte.id },
      data: { ultimaScansioneAt: new Date(), ultimoEsitoScan: "SUCCESSO", ultimoHashContenuto: hash },
    });
    await registraLog(fonte, "SUCCESSO", nuove, aggiornate);

    return { fonteId, nome: fonte.nome, saltata: false, esito: "SUCCESSO", misureNuove: nuove, misureAggiornate: aggiornate };
  } catch (err) {
    const messaggio = messaggioErroreFetch(err);
    await prisma.fonte.update({
      where: { id: fonte.id },
      data: { ultimaScansioneAt: new Date(), ultimoEsitoScan: "ERRORE" },
    });
    await registraLog(fonte, "ERRORE", 0, 0, messaggio);
    return { fonteId, nome: fonte.nome, saltata: false, esito: "ERRORE", errore: messaggio };
  }
}

async function registraLog(
  fonte: Fonte,
  esito: "SUCCESSO" | "ERRORE" | "BLOCCATO_ROBOTS",
  misureNuove: number,
  misureAggiornate: number,
  messaggioErrore?: string,
) {
  await prisma.scanLog.create({
    data: {
      fonteId: fonte.id,
      esito,
      misureNuove,
      misureAggiornate,
      messaggioErrore,
      completatoAt: new Date(),
    },
  });
}

/**
 * Scansiona tutte le fonti attive che risultano dovute, in sequenza e con
 * una piccola pausa tra una fonte e l'altra: non c'è motivo di bombardare
 * in parallelo i siti di enti pubblici solo perché tecnicamente potremmo
 * (ogni fonte è comunque un dominio diverso — la pausa qui è educazione
 * verso l'insieme dei siti pubblici, il vero limite di frequenza per
 * singolo sito resta `frequenzaOreScan` su ciascuna Fonte).
 *
 * Con decine di fonti attive uno scan completo può superare il limite di
 * durata di una singola esecuzione serverless (es. Vercel Hobby): non è un
 * problema — ogni fonte salva il suo risultato subito dopo lo scan (non a
 * fine batch), quindi un'esecuzione interrotta a metà lascia comunque
 * salvato tutto il lavoro fatto fino a quel punto, e le fonti rimaste
 * "dovute" vengono riprese al giro di cron successivo.
 */
export async function scanFontiDovute(opts: { forza?: boolean } = {}): Promise<EsitoScanFonte[]> {
  const fonti = await prisma.fonte.findMany({ where: { attiva: true } });
  const risultati: EsitoScanFonte[] = [];

  for (const fonte of fonti) {
    const risultato = await scanFonte(fonte.id, opts);
    risultati.push(risultato);
    if (!risultato.saltata) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return risultati;
}
