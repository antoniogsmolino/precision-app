import { prisma } from "@/lib/prisma";
import { risolviParser } from "./parsers/registry";
import { verificaRobotsTxt } from "./robots";
import { hashContenuto } from "./parsers/shared";
import { HEADERS_FETCH, messaggioErroreFetch } from "./http";
import { arricchisciConDettaglio } from "./dettaglio";
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
  tipoAgevolazione: string; tipoValore: string; descrizioneEstesa: string; altriRequisiti: string | null;
  importoFisso: unknown; importoMin: unknown; importoMax: unknown; percentuale: unknown; tettoMassimo: unknown;
  atecoAmmessi: string[]; atecoEsclusi: string[]; regioniAmmesse: string[]; documentiRichiesti: string[];
}): boolean {
  const arrayUguale = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
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
    (a.tettoMassimo ?? null) === (esistente.tettoMassimo == null ? null : Number(esistente.tettoMassimo)) &&
    // Confronta anche i campi arricchiti dalla pagina di dettaglio: senza
    // questo, una misura creata PRIMA dell'arricchimento (solo dati dalla
    // pagina elenco) non veniva mai aggiornata con i dati ricchi trovati
    // da una scansione successiva, perché nessuno dei campi sopra
    // cambiava — restava per sempre con la scheda vuota.
    (a.descrizioneEstesa ?? a.descrizioneBreve) === esistente.descrizioneEstesa &&
    (a.altriRequisiti ?? null) === esistente.altriRequisiti &&
    arrayUguale(a.atecoAmmessi ?? [], esistente.atecoAmmessi) &&
    arrayUguale(a.atecoEsclusi ?? [], esistente.atecoEsclusi) &&
    arrayUguale(a.regioniAmmesse ?? [], esistente.regioniAmmesse) &&
    arrayUguale(a.documentiRichiesti ?? [], esistente.documentiRichiesti)
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

    // Diagnostica per il caso "fetch riuscito ma (quasi) zero misure trovate":
    // senza questo, un fetch che porta a casa una pagina vuota/quasi-vuota
    // (es. contenuto caricato via JavaScript lato client, che il motore —
    // che legge solo l'HTML grezzo — non vede) è indistinguibile da un
    // fetch che porta a casa la pagina vera ma con selettori/euristica che
    // non riconoscono la sua struttura, o da una pagina che elenca solo
    // 1-2 misure "in evidenza" in HTML statico e nasconde il resto
    // dell'elenco dietro un caricamento via JavaScript (paginazione/filtri
    // lato client) — stessa "SUCCESSO, N misure" bassissimo in tutti questi
    // casi molto diversi tra loro. La soglia è <= 2, non solo 0: un sito
    // reale con decine di misure che ne restituisce 1 è comunque un
    // fallimento da diagnosticare, non un successo. Contare i tag <a> e le
    // occorrenze delle parole chiave di dominio nell'HTML grezzo permette
    // di distinguere questi casi dal solo ScanLog, senza dover ispezionare
    // la pagina a mano ogni volta:
    //  - pochissimi link totali -> pagina vuota/caricata via JS lato client;
    //  - tanti link ma pochissime parole chiave di dominio nel testo grezzo
    //    -> il contenuto reale (elenco misure) probabilmente non è nell'HTML
    //    servito al fetch, ma caricato dopo via JS (stesso caso di sopra,
    //    ma su una pagina che non è vuota per altri motivi: menu, footer...);
    //  - tanti link E tante parole chiave nel testo grezzo, ma poche misure
    //    estratte -> il contenuto reale C'È nell'HTML statico, il problema
    //    è nei selettori/euristica che non lo riconoscono: qui serve l'HTML
    //    reale della pagina (chiederlo al team) per calibrare i selettori,
    //    non altro tuning alla cieca.
    let diagnosticaZeroMisure: string | undefined;
    if (misure.length <= 2) {
      const numeroLinkTotali = (html.match(/<a[\s>]/gi) ?? []).length;
      const PAROLE_CHIAVE_DIAGNOSTICA = /\b(bando|bandi|avviso|avvisi|voucher|contributo|contributi|incentivo|incentivi|finanziamento|finanziamenti|agevolazione|agevolazioni)\b/gi;
      const occorrenzeParoleChiave = (html.match(PAROLE_CHIAVE_DIAGNOSTICA) ?? []).length;

      if (numeroLinkTotali < 5) {
        diagnosticaZeroMisure = `${misure.length} misure estratte — HTML di ${html.length} caratteri con solo ${numeroLinkTotali} link totali: probabile pagina vuota/caricata via JavaScript, non un problema di selettori.`;
      } else if (occorrenzeParoleChiave < 5) {
        diagnosticaZeroMisure = `${misure.length} misure estratte — HTML di ${html.length} caratteri, ${numeroLinkTotali} link totali ma solo ${occorrenzeParoleChiave} occorrenze di parole chiave di dominio (bando/avviso/incentivo/contributo/...): probabile che l'elenco vero delle misure sia caricato via JavaScript lato client (paginazione/filtri) e non presente nell'HTML servito al fetch, non un problema di selettori.`;
      } else {
        diagnosticaZeroMisure = `${misure.length} misure estratte — HTML di ${html.length} caratteri con ${numeroLinkTotali} link totali e ${occorrenzeParoleChiave} occorrenze di parole chiave di dominio: la pagina ha contenuto pertinente in HTML statico ma pochissimo supera il filtro di rilevanza/i selettori, probabile problema di selettori/struttura da calibrare sull'HTML reale della pagina.`;
      }
    }

    let nuove = 0;
    let aggiornate = 0;

    for (const grezzaBase of misure) {
      const esistente = await prisma.misura.findUnique({
        where: { fonteId_externalId: { fonteId: fonte.id, externalId: grezzaBase.externalId } },
      });

      // Arricchimento dalla pagina di DETTAGLIO (importo, scadenza, ATECO,
      // fatturato, dipendenti, documenti — la pagina elenco non li ha quasi
      // mai): salta la visita se la misura esiste già e risulta già
      // arricchita (non serve rifetchare ogni giorno un dettaglio che non
      // cambia), altrimenti scan molto più lente su fonti con tante voci.
      // "Già arricchita" = ha una descrizione estesa diversa dal solo
      // titolo/breve E almeno un requisito in più oltre ai dati minimi.
      const giaArricchita =
        esistente &&
        esistente.descrizioneEstesa !== esistente.descrizioneBreve &&
        (esistente.altriRequisiti || esistente.documentiRichiesti.length > 0 || esistente.atecoAmmessi.length > 0);
      const grezza = giaArricchita ? grezzaBase : await arricchisciConDettaglio(grezzaBase);

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
            descrizioneEstesa: grezza.descrizioneEstesa ?? grezza.descrizioneBreve,
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
            atecoAmmessi: grezza.atecoAmmessi ?? [],
            atecoEsclusi: grezza.atecoEsclusi ?? [],
            regioniAmmesse: grezza.regioniAmmesse ?? [],
            fatturatoMin: grezza.fatturatoMin ?? null,
            fatturatoMax: grezza.fatturatoMax ?? null,
            dipendentiMin: grezza.dipendentiMin ?? null,
            dipendentiMax: grezza.dipendentiMax ?? null,
            altriRequisiti: grezza.altriRequisiti ?? null,
            documentiRichiesti: grezza.documentiRichiesti ?? [],
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
    await registraLog(fonte, "SUCCESSO", nuove, aggiornate, diagnosticaZeroMisure);

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
