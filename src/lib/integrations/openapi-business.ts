/**
 * Risoluzione di una Partita IVA in anagrafica azienda per il frontend
 * pubblico "Finanza Agevolata Match" (Fase 3) — un'azienda che conosce già
 * la propria P.IVA e vuole sapere quali bandi può richiedere.
 *
 * Riusa lo STESSO adapter OpenAPI (IT-advanced, l'unico endpoint che nelle
 * specifiche del team accetta una P.IVA come identificativo — Search da
 * sola restituisce solo ID) e la STESSA cache aziende del motore di
 * prospecting automatico (src/lib/prospecting/) usato per i bandi: una
 * P.IVA cercata qui e poi trovata anche da una ricerca automatica su un
 * bando (o viceversa) non genera una seconda chiamata Advanced a
 * pagamento, esattamente come richiesto dalle specifiche (§1, "una nuova
 * associazione azienda–bando non deve provocare automaticamente una nuova
 * chiamata Advanced").
 *
 * Prima di questa versione il codice puntava a un endpoint indovinato
 * (`IT-start`, mai confermato) — ora usa `IT-advanced/{piva}`, l'endpoint
 * che le specifiche di funzionamento del team confermano esplicitamente
 * (§7). Endpoint, autenticazione e forma della risposta sono stati
 * verificati con richieste reali il 03/09/2026 (vedi i commenti in testa
 * a src/lib/prospecting/openapi-client.ts e advanced-mapper.ts).
 */
import { chiamaAdvanced } from "@/lib/prospecting/openapi-client";
import { mappaRispostaAdvanced } from "@/lib/prospecting/advanced-mapper";
import { trovaInCacheValida, salvaSnapshotAzienda, type DatiAziendaRisolti } from "@/lib/prospecting/cache";
import { prenotaSpesa } from "@/lib/prospecting/budget";

export type { DatiAziendaRisolti };

export type EsitoRicercaAzienda =
  | { ok: true; dati: DatiAziendaRisolti }
  | { ok: false; motivo: "PIVA_NON_TROVATA" | "ERRORE_API" | "NON_CONFIGURATO" | "BUDGET_ESAURITO" };

function normalizzaPiva(piva: string): string {
  return piva.replace(/\s+/g, "").toUpperCase();
}

/** true se la stringa ha la forma di una partita IVA italiana (11 cifre). */
export function pivaFormalmenteValida(piva: string): boolean {
  return /^\d{11}$/.test(normalizzaPiva(piva));
}

/**
 * Risolve una Partita IVA in anagrafica azienda. Controlla prima la cache
 * (nessuna spesa se i dati sono già stati acquisiti ed entro la TTL, da
 * qualunque flusso — anche una ricerca automatica su un bando), altrimenti
 * chiama Advanced spendendo dal budget condiviso.
 *
 * Non lancia mai eccezioni verso il chiamante: ogni fallimento (chiave non
 * configurata, budget esaurito, rete, piva non trovata, risposta non
 * interpretabile) torna come esito esplicito, mai come dato inventato.
 */
export async function recuperaDatiAzienda(piva: string): Promise<EsitoRicercaAzienda> {
  if (!process.env.OPENAPI_IT_API_KEY) {
    return { ok: false, motivo: "NON_CONFIGURATO" };
  }

  const pivaNorm = normalizzaPiva(piva);

  const inCache = await trovaInCacheValida({ piva: pivaNorm });
  if (inCache) {
    return {
      ok: true,
      dati: {
        ragioneSociale: inCache.ragioneSociale,
        piva: inCache.piva,
        openApiId: inCache.openApiId,
        ateco: inCache.ateco,
        regione: inCache.regione,
        provincia: inCache.provincia,
        fatturato: inCache.fatturato != null ? Number(inCache.fatturato) : null,
        numeroDipendenti: inCache.numeroDipendenti,
        pec: inCache.pec,
      },
    };
  }

  const prenotazione = await prenotaSpesa({ tipo: "ADVANCED", unita: 1 });
  if (!prenotazione.concesso) {
    return { ok: false, motivo: "BUDGET_ESAURITO" };
  }

  const esito = await chiamaAdvanced(pivaNorm);
  if (!esito.ok || !esito.dati) {
    return { ok: false, motivo: esito.status === 404 ? "PIVA_NON_TROVATA" : "ERRORE_API" };
  }

  const dati = mappaRispostaAdvanced(esito.dati, pivaNorm);
  if (!dati) {
    return { ok: false, motivo: "PIVA_NON_TROVATA" };
  }

  await salvaSnapshotAzienda(dati, "Finanza Agevolata Match (pubblico)");
  return { ok: true, dati };
}
