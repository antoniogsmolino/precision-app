/**
 * Integrazione con openapi.it (prodotto "Business Information") — risolve
 * una Partita IVA in anagrafica azienda (ragione sociale, ATECO, sede) per
 * il frontend pubblico "Finanza Agevolata Match" (Fase 3).
 *
 * ATTENZIONE — MAPPATURA DA VERIFICARE CONTRO UNA RISPOSTA REALE.
 * Non ho accesso diretto a Internet da questo ambiente (stesso limite di
 * tutta questa sessione — vedi i parser di scansione fonti, calibrati solo
 * con HTML reale mandato dal team), quindi non ho potuto testare la vera
 * forma della risposta di questa API. La mappatura sotto (`mappaRisposta`)
 * è una struttura ragionevole per un prodotto di business information
 * italiano, MA va confermata: se il primo tentativo reale in produzione
 * torna con ragione sociale/ATECO/regione vuoti nonostante una risposta
 * HTTP 200, il problema è quasi certamente qui — mandami un esempio reale
 * di risposta JSON (anche con dati anonimizzati, basta la struttura) e la
 * sistemo subito, stessa cosa fatta per i parser dei siti delle fonti.
 *
 * `OPENAPI_IT_BASE_URL`: la request va verso `${BASE_URL}/{piva}` — di
 * default punta a `https://company.openapi.com/IT-start`, l'endpoint del
 * prodotto "Company" di OpenAPI.com più comunemente usato per questo tipo
 * di lookup. Se il vostro account usa un endpoint diverso (es. un dominio
 * dedicato, o `/business-information/{piva}` invece di `/IT-start/{piva}`),
 * impostate `OPENAPI_IT_BASE_URL` di conseguenza — nessun redeploy di
 * codice necessario, solo la env var.
 */

const BASE_URL = process.env.OPENAPI_IT_BASE_URL ?? "https://company.openapi.com/IT-start";
const TIMEOUT_MS = 15_000;

export interface DatiAziendaRisolti {
  ragioneSociale: string;
  piva: string;
  ateco: string | null;
  regione: string | null;
  provincia: string | null;
  /** Non sempre disponibile da un semplice lookup anagrafico — molti piani
   * "business information" danno solo dati di registro (ragione sociale,
   * ATECO, sede), non bilancio. Se manca, il motore di matching lo tratta
   * comunque come "da verificare", mai come motivo di esclusione. */
  fatturato: number | null;
  numeroDipendenti: number | null;
}

export type EsitoRicercaAzienda =
  | { ok: true; dati: DatiAziendaRisolti }
  | { ok: false; motivo: "PIVA_NON_TROVATA" | "ERRORE_API" | "NON_CONFIGURATO" };

function normalizzaPiva(piva: string): string {
  return piva.replace(/\s+/g, "").toUpperCase();
}

/** true se la stringa ha la forma di una partita IVA italiana (11 cifre). */
export function pivaFormalmenteValida(piva: string): boolean {
  return /^\d{11}$/.test(normalizzaPiva(piva));
}

/**
 * Legge i campi che servono da una risposta la cui struttura esatta non è
 * ancora stata verificata contro l'API reale — prova più percorsi
 * plausibili per ogni campo (nomi diversi usati da prodotti simili) invece
 * di assumerne uno solo, così un'unica discrepanza di naming non fa
 * fallire tutto il resto. Non inventa MAI un valore: se un campo non si
 * trova in nessuno dei percorsi provati resta null.
 */
function mappaRisposta(raw: any, piva: string): DatiAziendaRisolti | null {
  const corpo = raw?.data ?? raw?.result ?? raw ?? {};

  const ragioneSociale: string | undefined =
    corpo.companyName ?? corpo.businessName ?? corpo.ragioneSociale ?? corpo.name ?? corpo.denominazione;
  if (!ragioneSociale) return null; // senza nemmeno la ragione sociale, la risposta non è utilizzabile

  const atecoRaw =
    corpo.atecoClassification?.ateco2007?.code ??
    corpo.ateco?.code ??
    corpo.atecoCode ??
    corpo.codiceAteco ??
    corpo.ateco ??
    null;

  const sede = corpo.registeredOffice ?? corpo.sedeLegale ?? corpo.address ?? {};
  const regione: string | null = sede.region ?? sede.regione ?? corpo.region ?? corpo.regione ?? null;
  const provincia: string | null = sede.province ?? sede.provincia ?? corpo.province ?? corpo.provincia ?? null;

  const fatturatoRaw =
    corpo.revenue ?? corpo.fatturato ?? corpo.balanceSheet?.revenue ?? corpo.financials?.revenue ?? null;
  const dipendentiRaw =
    corpo.employees ?? corpo.numeroDipendenti ?? corpo.companySize?.employees ?? corpo.employeesCount ?? null;

  return {
    ragioneSociale: String(ragioneSociale).trim(),
    piva: normalizzaPiva(piva),
    ateco: atecoRaw ? String(atecoRaw).trim() : null,
    regione: regione ? String(regione).trim() : null,
    provincia: provincia ? String(provincia).trim() : null,
    fatturato: fatturatoRaw != null && Number.isFinite(Number(fatturatoRaw)) ? Number(fatturatoRaw) : null,
    numeroDipendenti: dipendentiRaw != null && Number.isFinite(Number(dipendentiRaw)) ? Number(dipendentiRaw) : null,
  };
}

/**
 * Risolve una Partita IVA in anagrafica azienda tramite openapi.it.
 * Non lancia mai eccezioni verso il chiamante: ogni fallimento (chiave non
 * configurata, rete, piva non trovata, risposta non interpretabile) torna
 * come esito esplicito, mai come dato inventato.
 */
export async function recuperaDatiAzienda(piva: string): Promise<EsitoRicercaAzienda> {
  const apiKey = process.env.OPENAPI_IT_API_KEY;
  if (!apiKey) {
    return { ok: false, motivo: "NON_CONFIGURATO" };
  }

  const pivaNorm = normalizzaPiva(piva);

  try {
    const res = await fetch(`${BASE_URL}/${pivaNorm}`, {
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 404) {
      return { ok: false, motivo: "PIVA_NON_TROVATA" };
    }
    if (!res.ok) {
      return { ok: false, motivo: "ERRORE_API" };
    }

    const json = await res.json();
    const dati = mappaRisposta(json, pivaNorm);
    if (!dati) {
      return { ok: false, motivo: "PIVA_NON_TROVATA" };
    }

    return { ok: true, dati };
  } catch {
    return { ok: false, motivo: "ERRORE_API" };
  }
}
