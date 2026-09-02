import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { risolviAdapter } from "./adapters/registry";
import { validaBandoNormalizzato, calcolaStatoPubblicazione } from "./validazione";
import type { BandoNormalizzato, CampoConEvidenza } from "./adapters/tipi";
import { ricalcolaTuttiIMatch } from "@/lib/matching/engine";
import { verificaRobotsTxt } from "@/lib/monitoring/robots";
import type { Fonte } from "@prisma/client";

/** Dimensione dei lotti per le scritture in blocco (createMany) — abbastanza grande da ridurre drasticamente il numero di round-trip al database, abbastanza piccola da restare ben sotto i limiti di parametri di una singola query. */
const DIMENSIONE_LOTTO = 500;
/** Concorrenza per gli update individuali (nessun bulk-update nativo in Prisma con valori diversi per riga) — abbinata a un pool di connessioni tipico, non lo sommerge. */
const CONCORRENZA_UPDATE = 20;

function* inLotti<T>(elementi: T[], dimensione: number): Generator<T[]> {
  for (let i = 0; i < elementi.length; i += dimensione) yield elementi.slice(i, i + dimensione);
}

const HTTP_TIMEOUT_ANOMALIA = 5; // consecutiveFailures oltre cui healthStatus passa a BLOCKED invece di FAILING
const SOGLIA_ASSENZE_SEGNALAZIONE = 2; // assenze consecutive dal feed oltre cui si logga ASSENTE_DA_FONTE (un margine di 1 scan per non segnalare un singolo scarto transitorio)

export interface EsitoIngestFonte {
  fonteId: string;
  nome: string;
  saltata: boolean;
  motivoSalto?: string;
  esito?: "SUCCESSO" | "ERRORE" | "BLOCCATO_ROBOTS";
  bandiTotaliNelFeed?: number;
  bandiValidi?: number;
  bandiScartati?: number;
  errateValidazioni?: string[];
  misureNuove?: number;
  misureAggiornate?: number;
  errore?: string;
}

function hashCorpo(corpo: string): string {
  return createHash("sha256").update(corpo).digest("hex");
}

/**
 * "fetch failed" da solo (il messaggio top-level che Node/undici usa per
 * quasi ogni fallimento di rete — DNS, TLS, connessione rifiutata,
 * timeout...) non dice nulla di utile: la vera causa è quasi sempre
 * annidata in `error.cause`, non inclusa da un semplice `err.message`.
 * Percorre la catena di cause per non ritrovarsi mai più con un log che
 * dice solo "fetch failed" senza sapere perché (successo la prima volta
 * che questo adapter ha girato per davvero, in produzione).
 */
function descriviErrore(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parti = [err.message];
  let causa = (err as { cause?: unknown }).cause;
  let profondita = 0;
  while (causa && profondita < 5) {
    if (causa instanceof Error) {
      parti.push(`causa: ${causa.message}${"code" in causa ? ` (${(causa as any).code})` : ""}`);
      causa = (causa as { cause?: unknown }).cause;
    } else {
      parti.push(`causa: ${String(causa)}`);
      causa = undefined;
    }
    profondita += 1;
  }
  return parti.join(" — ");
}

/** Fingerprint dei soli campi rilevanti — un fetch che riporta lo stesso contenuto non deve riscrivere né generare evidence/eventi spuri (stesso principio del vecchio motore, engine.ts:campiRilevantiUguali). */
function fingerprintBando(b: BandoNormalizzato): string {
  const rilevante = {
    titolo: b.titolo.valore,
    ente: b.ente.valore,
    dataApertura: b.dataApertura.valore?.getTime() ?? null,
    dataScadenza: b.dataScadenza.valore?.getTime() ?? null,
    tipoAgevolazione: b.tipoAgevolazione.valore,
    tipoValore: b.tipoValore.valore,
    importoFisso: b.importoFisso.valore,
    importoMax: b.importoMax.valore,
    percentuale: b.percentuale.valore,
    tettoMassimo: b.tettoMassimo.valore,
    atecoAmmessi: b.atecoAmmessi.valore,
    regioniAmmesse: b.regioniAmmesse.valore,
    linkFonteUfficiale: b.linkFonteUfficiale.valore,
  };
  return hashCorpo(JSON.stringify(rilevante));
}

const CAMPI_EVIDENCE: Array<[string, keyof BandoNormalizzato]> = [
  ["titolo", "titolo"],
  ["ente", "ente"],
  ["descrizioneEstesa", "descrizioneEstesa"],
  ["dataApertura", "dataApertura"],
  ["dataScadenza", "dataScadenza"],
  ["tipoAgevolazione", "tipoAgevolazione"],
  ["importoFisso", "importoFisso"],
  ["importoMax", "importoMax"],
  ["percentuale", "percentuale"],
  ["tettoMassimo", "tettoMassimo"],
  ["atecoAmmessi", "atecoAmmessi"],
  ["regioniAmmesse", "regioniAmmesse"],
];

interface RigaEvidence {
  misuraId: string;
  campo: string;
  estrattoTesto: string | null;
  confidence: number;
  statoVerifica: "SUPPORTATA" | "NON_SUPPORTATA";
  metodoEstrazione: "OPEN_DATA" | "DERIVATO" | "MANUALE";
}

function costruisciRigheEvidence(misuraId: string, bando: BandoNormalizzato): RigaEvidence[] {
  const righe: RigaEvidence[] = [];
  for (const [nomeCampo, chiave] of CAMPI_EVIDENCE) {
    const c = bando[chiave] as CampoConEvidenza<unknown>;
    // Nessuna evidence per un valore assente: la specifica vieta di
    // "riempire" un campo non trovato — qui, semplicemente, non si scrive
    // una riga che finirebbe per sembrare una conferma di qualcosa che non
    // c'è (§26/§29).
    if (c.valore === null || c.valore === undefined) continue;
    righe.push({
      misuraId,
      campo: nomeCampo,
      estrattoTesto: c.estrattoTesto ?? null,
      confidence: c.confidence,
      statoVerifica: c.confidence >= 0.5 ? "SUPPORTATA" : "NON_SUPPORTATA",
      metodoEstrazione: c.metodoEstrazione,
    });
  }
  return righe;
}

function costruisciDatiComuni(bando: BandoNormalizzato) {
  return {
    titolo: bando.titolo.valore!,
    ente: bando.ente.valore!,
    descrizioneBreve: bando.descrizioneBreve.valore ?? bando.titolo.valore!,
    descrizioneEstesa: bando.descrizioneEstesa.valore ?? bando.titolo.valore!,
    tipoAgevolazione: bando.tipoAgevolazione.valore!,
    tipoValore: bando.tipoValore.valore!,
    importoFisso: bando.importoFisso.valore,
    importoMax: bando.importoMax.valore,
    percentuale: bando.percentuale.valore,
    tettoMassimo: bando.tettoMassimo.valore,
    dataApertura: bando.dataApertura.valore!,
    dataScadenza: bando.dataScadenza.valore!,
    scadenzaStimata: bando.scadenzaStimata,
    atecoAmmessi: bando.atecoAmmessi.valore ?? [],
    regioniAmmesse: bando.regioniAmmesse.valore ?? [],
    linkFonteUfficiale: bando.linkFonteUfficiale.valore!,
    statoDichiarato: bando.statoDichiarato,
    statoPubblicazione: calcolaStatoPubblicazione(bando),
  };
}

/**
 * Ingest di UNA fonte Tier 0/1 gestita dal nuovo motore bandi (Fonte.adapterKey
 * valorizzato) — mirror concettuale di scanFonte() del vecchio motore
 * (src/lib/monitoring/engine.ts), stesso stile di non lanciare mai
 * eccezioni verso il chiamante e di aggiornare Fonte/ScanLog in modo che
 * la pagina /fonti mostri entrambi i motori in modo uniforme.
 */
export async function ingestFonte(fonteId: string, opts: { forza?: boolean } = {}): Promise<EsitoIngestFonte> {
  const fonte = await prisma.fonte.findUnique({ where: { id: fonteId } });
  if (!fonte) return { fonteId, nome: "(sconosciuta)", saltata: true, motivoSalto: "Fonte non trovata" };
  if (!fonte.attiva) return { fonteId, nome: fonte.nome, saltata: true, motivoSalto: "Fonte disattivata" };

  if (!opts.forza && fonte.ultimaScansioneAt) {
    const prossimaOk = Date.now() - fonte.ultimaScansioneAt.getTime() >= fonte.frequenzaOreScan * 60 * 60 * 1000;
    if (!prossimaOk) {
      return { fonteId, nome: fonte.nome, saltata: true, motivoSalto: "Non ancora dovuta (rate limit fonte)" };
    }
  }

  const adapter = risolviAdapter(fonte.adapterKey);
  if (!adapter) {
    return {
      fonteId,
      nome: fonte.nome,
      saltata: true,
      motivoSalto: `Nessun adapter registrato per adapterKey="${fonte.adapterKey ?? "(non impostato)"}"`,
    };
  }

  // Stesso controllo del vecchio motore (specifica, §62): mai bypassare un
  // Disallow, anche per un endpoint dati pubblico.
  const robots = await verificaRobotsTxt(fonte.url);
  if (!robots.consentito) {
    await prisma.fonte.update({ where: { id: fonte.id }, data: { ultimaScansioneAt: new Date(), ultimoEsitoScan: "BLOCCATO_ROBOTS" } });
    await registraScanLog(fonte, "BLOCCATO_ROBOTS", 0, 0, robots.motivo);
    return { fonteId, nome: fonte.nome, saltata: false, esito: "BLOCCATO_ROBOTS" };
  }

  try {
    const risorse = await adapter.discover({ url: fonte.url });
    let bandiTotali = 0;
    let bandiValidi = 0;
    let bandiScartati = 0;
    const errateValidazioni: string[] = [];
    let nuove = 0;
    let aggiornate = 0;

    for (const risorsa of risorse) {
      const grezzo = await adapter.fetch(risorsa);
      const sha = hashCorpo(grezzo.corpo);

      // Raw sempre conservato (specifica, §14) — ma una nuova riga solo se
      // il contenuto è davvero cambiato dall'ultimo fetch di questa fonte:
      // altrimenti un dataset da qualche MB scansionato ogni 2 ore
      // accumulerebbe copie identiche indefinitamente. Il principio
      // "mai processare senza l'originale" resta rispettato: l'originale
      // di ogni versione DISTINTA è comunque sempre lì.
      const ultimoSnapshot = await prisma.rawSnapshot.findFirst({
        where: { fonteId: fonte.id },
        orderBy: { fetchedAt: "desc" },
      });
      if (!ultimoSnapshot || ultimoSnapshot.sha256 !== sha) {
        await prisma.rawSnapshot.create({
          data: {
            fonteId: fonte.id,
            url: grezzo.urlRisorsa,
            statusCode: grezzo.statusCode,
            contentType: grezzo.contentType,
            sha256: sha,
            corpo: grezzo.corpo,
          },
        });
      }

      const bandiNormalizzati = adapter.normalize(grezzo);
      bandiTotali += bandiNormalizzati.length;

      // --- Passata 1: validazione (in memoria, nessuna query) --------------
      const validi: { bando: BandoNormalizzato; incentiviGovId: string | null }[] = [];
      for (const bando of bandiNormalizzati) {
        const validazione = validaBandoNormalizzato(bando);
        if (!validazione.valido) {
          bandiScartati += 1;
          errateValidazioni.push(`"${bando.titolo.valore ?? "(senza titolo)"}": ${validazione.errori.join("; ")}`);
          continue;
        }
        bandiValidi += 1;
        validi.push({ bando, incentiviGovId: bando.identificatoriEsterni.incentiviGovId ?? null });
      }

      // --- Passata 2: UNA sola query per sapere quali esistono già ---------
      // (prima era un findUnique per bando: con un feed di migliaia di
      // record, migliaia di round-trip sequenziali al database — abbastanza
      // lento da far scadere il timeout di una funzione serverless. Trovato
      // sul primo run reale contro Incentivi.gov.it, ~5.800 bandi.)
      const idsConValore = validi.map((v) => v.incentiviGovId).filter((id): id is string => id !== null);
      const esistentiRows = idsConValore.length > 0 ? await prisma.misura.findMany({ where: { incentiviGovId: { in: idsConValore } } }) : [];
      const esistentiMap = new Map(esistentiRows.map((r) => [r.incentiviGovId as string, r]));

      const daCreare: { bando: BandoNormalizzato; incentiviGovId: string | null; id: string }[] = [];
      const daAggiornare: { bando: BandoNormalizzato; esistente: (typeof esistentiRows)[number] }[] = [];

      for (const { bando, incentiviGovId } of validi) {
        const esistente = incentiviGovId ? esistentiMap.get(incentiviGovId) : undefined;
        if (!esistente) {
          daCreare.push({ bando, incentiviGovId, id: randomUUID() });
          continue;
        }
        const fingerprintNuovo = fingerprintBando(bando);
        const fingerprintEsistente = hashCorpo(
          JSON.stringify({
            titolo: esistente.titolo,
            ente: esistente.ente,
            dataApertura: esistente.dataApertura.getTime(),
            dataScadenza: esistente.dataScadenza.getTime(),
            tipoAgevolazione: esistente.tipoAgevolazione,
            tipoValore: esistente.tipoValore,
            importoFisso: esistente.importoFisso ? Number(esistente.importoFisso) : null,
            importoMax: esistente.importoMax ? Number(esistente.importoMax) : null,
            percentuale: esistente.percentuale ? Number(esistente.percentuale) : null,
            tettoMassimo: esistente.tettoMassimo ? Number(esistente.tettoMassimo) : null,
            atecoAmmessi: esistente.atecoAmmessi,
            regioniAmmesse: esistente.regioniAmmesse,
            linkFonteUfficiale: esistente.linkFonteUfficiale,
          }),
        );
        // Invariato: nessuna riga toccata, nessun evidence/evento spurio.
        if (fingerprintNuovo !== fingerprintEsistente) daAggiornare.push({ bando, esistente });
      }

      // --- Passata 3: creazioni in blocco ----------------------------------
      // id pre-generato lato applicazione (randomUUID, non cuid — il campo
      // è un semplice String @id, nessun vincolo di formato) apposta per
      // poter usare createMany sulla Misura E sulle tabelle figlie
      // (Finestra/Evidence/Evento) senza dover rileggere l'id da un create
      // singolo — quel giro singolo-per-riga è esattamente ciò che rendeva
      // lento tutto il resto.
      for (const lotto of inLotti(daCreare, DIMENSIONE_LOTTO)) {
        await prisma.misura.createMany({
          data: lotto.map(({ bando, incentiviGovId, id }) => ({
            id,
            ...costruisciDatiComuni(bando),
            categoria: "NAZIONALE" as const,
            incentiviGovId,
            rilevataAutomaticamente: true,
            fonteId: fonte.id,
            externalId: incentiviGovId ?? hashCorpo(bando.titolo.valore! + bando.linkFonteUfficiale.valore),
          })),
        });

        await prisma.finestraTemporale.createMany({
          data: lotto.map(({ bando, id }) => ({
            misuraId: id,
            apreIl: bando.dataApertura.valore,
            chiudeIl: bando.scadenzaStimata ? null : bando.dataScadenza.valore,
            tipoChiusura: bando.scadenzaStimata ? ("SCONOSCIUTO" as const) : ("DATA_FISSA" as const),
            corrente: true,
          })),
        });

        const righeEvidence = lotto.flatMap(({ bando, id }) => costruisciRigheEvidence(id, bando));
        if (righeEvidence.length > 0) await prisma.evidence.createMany({ data: righeEvidence });

        await prisma.eventoBando.createMany({
          data: lotto.map(({ id, incentiviGovId }) => ({
            misuraId: id,
            tipo: "SCOPERTO" as const,
            dettaglio: { fonteId: fonte.id, incentiviGovId },
          })),
        });
      }
      nuove += daCreare.length;

      // --- Passata 4: aggiornamenti, solo sulle righe DAVVERO cambiate -----
      // Ancora individuali (nessun bulk-update con valori diversi per riga
      // in Prisma) ma in parallelo a lotti, non uno alla volta in sequenza.
      for (const lotto of inLotti(daAggiornare, CONCORRENZA_UPDATE)) {
        await Promise.all(
          lotto.map(async ({ bando, esistente }) => {
            const scadenzaProrogata = bando.dataScadenza.valore && bando.dataScadenza.valore.getTime() > esistente.dataScadenza.getTime();
            await prisma.misura.update({ where: { id: esistente.id }, data: costruisciDatiComuni(bando) });
            const righeEvidence = costruisciRigheEvidence(esistente.id, bando);
            if (righeEvidence.length > 0) await prisma.evidence.createMany({ data: righeEvidence });
            await prisma.eventoBando.create({
              data: {
                misuraId: esistente.id,
                tipo: scadenzaProrogata ? "SCADENZA_PROROGATA" : "AGGIORNATO",
                dettaglio: {
                  scadenzaPrecedente: esistente.dataScadenza.toISOString(),
                  scadenzaNuova: bando.dataScadenza.valore?.toISOString() ?? null,
                },
              },
            });
          }),
        );
      }
      aggiornate += daAggiornare.length;

      // --- Passata 5: no-delete policy (specifica §37/§101 punto 4) --------
      // Ogni misura trovata in questo giro (nuova, aggiornata O invariata)
      // viene marcata "vista adesso": azzera eventuali assenze pregresse.
      // Conta la sola presenza nel feed, non il cambiamento di contenuto.
      const idsMisureVisteOra = [...daCreare.map((d) => d.id), ...esistentiRows.map((r) => r.id)];
      for (const lotto of inLotti(idsMisureVisteOra, DIMENSIONE_LOTTO)) {
        await prisma.misura.updateMany({ where: { id: { in: lotto } }, data: { ultimoVistoInFonteAt: new Date(), assenzeConsecutive: 0 } });
      }

      // Misure di QUESTA fonte non trovate in questo giro: MAI cancellate né
      // chiuse in automatico (specifica: la sparizione può dipendere da un
      // errore della fonte, non dalla vera chiusura del bando) — solo
      // incrementate e segnalate al backoffice per una conferma umana, una
      // volta sola (all'esatto momento in cui superano la soglia, non ogni
      // giorno da lì in poi).
      const assentiRows = await prisma.misura.findMany({
        where: { fonteId: fonte.id, id: idsMisureVisteOra.length > 0 ? { notIn: idsMisureVisteOra } : undefined },
        select: { id: true, assenzeConsecutive: true },
      });
      for (const lotto of inLotti(assentiRows, CONCORRENZA_UPDATE)) {
        await Promise.all(lotto.map((m) => prisma.misura.update({ where: { id: m.id }, data: { assenzeConsecutive: { increment: 1 } } })));
      }
      const appenaSopraSoglia = assentiRows.filter((m) => m.assenzeConsecutive + 1 === SOGLIA_ASSENZE_SEGNALAZIONE);
      if (appenaSopraSoglia.length > 0) {
        await prisma.eventoBando.createMany({
          data: appenaSopraSoglia.map((m) => ({
            misuraId: m.id,
            tipo: "ASSENTE_DA_FONTE" as const,
            dettaglio: { fonteId: fonte.id, assenzeConsecutive: SOGLIA_ASSENZE_SEGNALAZIONE },
          })),
        });
      }
    }

    // Un solo ricalcolo globale dei match a fine ingest invece di uno per
    // ogni misura creata/aggiornata (ricalcolaMatchPerMisura rifà da capo
    // il fetch di TUTTI i prospect a ogni chiamata — moltiplicato per
    // migliaia di misure era l'altra metà del problema di performance).
    if (nuove > 0 || aggiornate > 0) {
      await ricalcolaTuttiIMatch();
    }

    await prisma.fonte.update({
      where: { id: fonte.id },
      data: {
        ultimaScansioneAt: new Date(),
        ultimoEsitoScan: "SUCCESSO",
        healthStatus: "HEALTHY",
        consecutiveFailures: 0,
      },
    });
    await registraScanLog(fonte, "SUCCESSO", nuove, aggiornate, bandiScartati > 0 ? errateValidazioni.slice(0, 5).join(" | ") : undefined);

    return {
      fonteId,
      nome: fonte.nome,
      saltata: false,
      esito: "SUCCESSO",
      bandiTotaliNelFeed: bandiTotali,
      bandiValidi,
      bandiScartati,
      errateValidazioni: errateValidazioni.slice(0, 20),
      misureNuove: nuove,
      misureAggiornate: aggiornate,
    };
  } catch (err) {
    const messaggio = descriviErrore(err);
    const nuoveFailures = fonte.consecutiveFailures + 1;
    await prisma.fonte.update({
      where: { id: fonte.id },
      data: {
        ultimaScansioneAt: new Date(),
        ultimoEsitoScan: "ERRORE",
        consecutiveFailures: nuoveFailures,
        healthStatus: nuoveFailures >= HTTP_TIMEOUT_ANOMALIA ? "BLOCKED" : "FAILING",
      },
    });
    await registraScanLog(fonte, "ERRORE", 0, 0, messaggio);
    return { fonteId, nome: fonte.nome, saltata: false, esito: "ERRORE", errore: messaggio };
  }
}

async function registraScanLog(fonte: Fonte, esito: "SUCCESSO" | "ERRORE" | "BLOCCATO_ROBOTS", misureNuove: number, misureAggiornate: number, messaggioErrore?: string) {
  await prisma.scanLog.create({
    data: { fonteId: fonte.id, esito, misureNuove, misureAggiornate, messaggioErrore, completatoAt: new Date() },
  });
}

/**
 * Ingest di tutte le fonti attive del nuovo motore bandi (adapterKey
 * impostato) che risultano dovute — chiamata dal cron giornaliero insieme
 * a scanFontiDovute() del vecchio motore (src/app/api/cron/scan/route.ts),
 * così una fonte configurata per il nuovo motore parte da sola come
 * qualunque altra, senza un passo manuale separato. Stessa piccola pausa
 * fra una fonte e l'altra del vecchio motore, stesso motivo (educazione
 * verso i siti pubblici).
 */
export async function ingestFontiDovute(opts: { forza?: boolean } = {}): Promise<EsitoIngestFonte[]> {
  const fonti = await prisma.fonte.findMany({ where: { attiva: true, adapterKey: { not: null } } });
  const risultati: EsitoIngestFonte[] = [];

  for (const fonte of fonti) {
    const risultato = await ingestFonte(fonte.id, opts);
    risultati.push(risultato);
    if (!risultato.saltata) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return risultati;
}
