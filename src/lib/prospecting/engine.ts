import { prisma } from "@/lib/prisma";
import { compilaPianoQuery } from "./query-compiler";
import { chiamaSearch, chiamaAdvanced, mappaRispostaSearch } from "./openapi-client";
import { mappaRispostaAdvanced } from "./advanced-mapper";
import { trovaInCacheValida, salvaSnapshotAzienda } from "./cache";
import { prenotaSpesa, MAX_CANDIDATE_PER_RUN, MAX_ADVANCED_PER_RUN } from "./budget";
import { ricalcolaMatchPerMisura } from "@/lib/matching/engine";

/**
 * Motore di prospecting automatico — orchestrazione semplificata dello
 * pseudocodice §14 delle specifiche (process_funding_call): dato un
 * bando, cerca le aziende compatibili via IT-search, arricchisce solo le
 * candidate nuove via IT-advanced (riusando la cache per le altre),
 * valuta il match con lo STESSO motore a regole già usato dal CSV/dal
 * frontend pubblico, e aggiorna le opportunità.
 *
 * Semplificazioni ONESTE rispetto alle specifiche complete (documentate
 * qui, non nascoste):
 *  - Budget: reservation basata sul `limit` di pagina richiesto, non su
 *    un conteggio preventivo via `dryRun` a parte — un passaggio in meno
 *    di round-trip, a costo di riservare per un numero di record che
 *    potrebbe risultare leggermente maggiore di quelli davvero
 *    restituiti (mai il contrario: non si spende mai più di quanto
 *    riservato). Le specifiche stesse ammettono che S non rappresenta
 *    un conteggio esatto (§12).
 *  - Nessun lock distribuito (§8) — vedi il commento in budget.ts.
 *  - Una sola pagina per segmento di query (skip=0, limit=MAX_CANDIDATE_PER_RUN
 *    o meno) — niente paginazione persistente multi-pagina in questa
 *    prima versione: per un bando con più di MAX_CANDIDATE_PER_RUN
 *    candidate stimate, il run copre solo la prima pagina e lo dice
 *    esplicitamente nel risultato (`coperturaParziale`).
 */

export interface RisultatoRicerca {
  ok: boolean;
  logId: string;
  candidateTrovate: number;
  aziendeNuove: number;
  aziendeDaCache: number;
  matchTrovati: number;
  costoStimatoEur: number;
  coperturaParziale: boolean;
  messaggioErrore?: string;
}

export async function trovaAziendeCompatibili(misuraId: string): Promise<RisultatoRicerca> {
  const misura = await prisma.misura.findUnique({ where: { id: misuraId } });
  if (!misura) {
    throw new Error(`Misura ${misuraId} non trovata`);
  }

  const log = await prisma.ricercaProspectLog.create({
    data: { misuraId, esito: "IN_CORSO" },
  });

  try {
    const piano = compilaPianoQuery(misura, MAX_CANDIDATE_PER_RUN);
    const candidatiUnici = new Set<string>();
    let coperturaParziale = false;

    for (const segmento of piano) {
      const prenotazioneSearch = await prenotaSpesa({
        tipo: "SEARCH",
        unita: segmento.parametri.limit ?? MAX_CANDIDATE_PER_RUN,
        misuraId,
      });
      if (!prenotazioneSearch.concesso) {
        coperturaParziale = true;
        continue; // budget esaurito per questo segmento, si prova comunque il resto del piano
      }

      const esito = await chiamaSearch(segmento.parametri);
      if (!esito.ok || !esito.dati) {
        coperturaParziale = true;
        continue;
      }

      const { candidati, totaleStimato } = mappaRispostaSearch(esito.dati);
      candidati.forEach((id) => candidatiUnici.add(id));
      if (totaleStimato != null && totaleStimato > candidati.length) {
        coperturaParziale = true; // ci sono più risultati di quelli scaricati in questa pagina
      }
    }

    const candidateTrovate = candidatiUnici.size;
    const daArricchire = [...candidatiUnici].slice(0, MAX_ADVANCED_PER_RUN);
    if (candidatiUnici.size > daArricchire.length) coperturaParziale = true;

    let aziendeNuove = 0;
    let aziendeDaCache = 0;
    const prospectDaValutare: { id: string }[] = [];

    for (const candidatoId of daArricchire) {
      const inCache = await trovaInCacheValida({ openApiId: candidatoId });
      if (inCache) {
        aziendeDaCache++;
        prospectDaValutare.push({ id: inCache.id });
        continue;
      }

      const prenotazioneAdvanced = await prenotaSpesa({ tipo: "ADVANCED", unita: 1, misuraId });
      if (!prenotazioneAdvanced.concesso) {
        coperturaParziale = true;
        continue; // budget esaurito: candidata non arricchita, resta "da verificare" (non salvata come esclusa)
      }

      const esitoAdv = await chiamaAdvanced(candidatoId);
      if (!esitoAdv.ok || !esitoAdv.dati) {
        continue; // errore/non trovata: nessun dato inventato, si passa oltre
      }

      const dati = mappaRispostaAdvanced(esitoAdv.dati, candidatoId);
      if (!dati) continue;

      const prospect = await salvaSnapshotAzienda(dati, "OpenAPI IT-advanced");
      aziendeNuove++;
      prospectDaValutare.push({ id: prospect.id });
    }

    // Rivaluta il match con lo STESSO motore a regole del CSV/frontend
    // pubblico (src/lib/matching/engine.ts) — ricalcolaMatchPerMisura
    // valuta TUTTI i prospect esistenti contro questa misura (non solo
    // quelli appena trovati), quindi sincronizza anche eventuali match
    // non più validi; corretto e sicuro richiamarlo qui anche se in
    // questo run abbiamo arricchito solo un sottoinsieme di aziende.
    await ricalcolaMatchPerMisura(misuraId);
    const matchTrovati = await prisma.prospectMisuraMatch.count({ where: { misuraId } });

    const spese = await prisma.apiUsageLog.aggregate({
      where: { misuraId, creatoAt: { gte: log.avviataAt } },
      _sum: { costoStimato: true },
    });
    const costoStimatoEur = Number(spese._sum.costoStimato ?? 0);

    await prisma.ricercaProspectLog.update({
      where: { id: log.id },
      data: {
        esito: "SUCCESSO",
        completataAt: new Date(),
        candidateTrovate,
        aziendeNuove,
        aziendeDaCache,
        matchTrovati,
        costoStimato: costoStimatoEur,
      },
    });

    return { ok: true, logId: log.id, candidateTrovate, aziendeNuove, aziendeDaCache, matchTrovati, costoStimatoEur, coperturaParziale };
  } catch (err) {
    const messaggioErrore = err instanceof Error ? err.message : "Errore sconosciuto";
    await prisma.ricercaProspectLog.update({
      where: { id: log.id },
      data: { esito: "ERRORE", completataAt: new Date(), messaggioErrore },
    });
    return {
      ok: false,
      logId: log.id,
      candidateTrovate: 0,
      aziendeNuove: 0,
      aziendeDaCache: 0,
      matchTrovati: 0,
      costoStimatoEur: 0,
      coperturaParziale: false,
      messaggioErrore,
    };
  }
}
