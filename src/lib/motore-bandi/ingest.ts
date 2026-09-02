import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { risolviAdapter } from "./adapters/registry";
import { validaBandoNormalizzato, calcolaStatoPubblicazione } from "./validazione";
import type { BandoNormalizzato, CampoConEvidenza } from "./adapters/tipi";
import { ricalcolaMatchPerMisura } from "@/lib/matching/engine";
import type { Fonte } from "@prisma/client";

const HTTP_TIMEOUT_ANOMALIA = 5; // consecutiveFailures oltre cui healthStatus passa a BLOCKED invece di FAILING

export interface EsitoIngestFonte {
  fonteId: string;
  nome: string;
  saltata: boolean;
  motivoSalto?: string;
  esito?: "SUCCESSO" | "ERRORE";
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

async function scriviEvidence(misuraId: string, bando: BandoNormalizzato) {
  const righe: {
    misuraId: string;
    campo: string;
    estrattoTesto: string | null;
    confidence: number;
    statoVerifica: "SUPPORTATA" | "NON_SUPPORTATA";
    metodoEstrazione: "OPEN_DATA" | "DERIVATO" | "MANUALE";
  }[] = [];

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

  if (righe.length > 0) {
    await prisma.evidence.createMany({ data: righe });
  }
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

      for (const bando of bandiNormalizzati) {
        const validazione = validaBandoNormalizzato(bando);
        if (!validazione.valido) {
          bandiScartati += 1;
          errateValidazioni.push(`"${bando.titolo.valore ?? "(senza titolo)"}": ${validazione.errori.join("; ")}`);
          continue;
        }
        bandiValidi += 1;

        const incentiviGovId = bando.identificatoriEsterni.incentiviGovId ?? null;
        const esistente = incentiviGovId ? await prisma.misura.findUnique({ where: { incentiviGovId } }) : null;

        const datiComuni = {
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

        if (!esistente) {
          const creata = await prisma.misura.create({
            data: {
              ...datiComuni,
              categoria: "NAZIONALE",
              incentiviGovId,
              rilevataAutomaticamente: true,
              fonteId: fonte.id,
              externalId: incentiviGovId ?? hashCorpo(bando.titolo.valore! + bando.linkFonteUfficiale.valore),
            },
          });
          await prisma.finestraTemporale.create({
            data: {
              misuraId: creata.id,
              apreIl: bando.dataApertura.valore,
              chiudeIl: bando.scadenzaStimata ? null : bando.dataScadenza.valore,
              tipoChiusura: bando.scadenzaStimata ? "SCONOSCIUTO" : "DATA_FISSA",
              corrente: true,
            },
          });
          await scriviEvidence(creata.id, bando);
          await prisma.eventoBando.create({
            data: { misuraId: creata.id, tipo: "SCOPERTO", dettaglio: { fonteId: fonte.id, incentiviGovId } },
          });
          nuove += 1;
          await ricalcolaMatchPerMisura(creata.id);
        } else {
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

          if (fingerprintNuovo !== fingerprintEsistente) {
            const scadenzaProrogata =
              bando.dataScadenza.valore && bando.dataScadenza.valore.getTime() > esistente.dataScadenza.getTime();

            await prisma.misura.update({ where: { id: esistente.id }, data: datiComuni });
            await scriviEvidence(esistente.id, bando);
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
            aggiornate += 1;
            await ricalcolaMatchPerMisura(esistente.id);
          }
        }
      }
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
    const messaggio = err instanceof Error ? err.message : "Errore sconosciuto";
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

async function registraScanLog(fonte: Fonte, esito: "SUCCESSO" | "ERRORE", misureNuove: number, misureAggiornate: number, messaggioErrore?: string) {
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
