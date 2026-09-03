import type { DatiAziendaRisolti } from "./cache";

/**
 * Legge i campi che servono da una risposta IT-advanced. Verificato il
 * 03/09/2026 con una risposta REALE dell'ambiente sandbox
 * (test.company.openapi.com) — non più una struttura indovinata:
 *
 *   { "data": [ { "companyName", "vatCode", "taxCode", "id",
 *       "atecoClassification": { "ateco": { "code", "description" } },
 *       "address": { "registeredOffice": { "province",
 *         "region": { "code", "description" }, ... } },
 *       "pec", "balanceSheets": { "last": { "turnover", "employees", ... },
 *       "all": [...] }, ... } ], "success", "message", "error" }
 *
 * Due dettagli non ovvi confermati dalla risposta reale:
 *  - "data" è un ARRAY anche quando si cerca un solo identificativo — il
 *    primo elemento è l'azienda trovata (fondamentale: senza questo, il
 *    codice precedente leggeva i campi dall'array stesso, sempre undefined).
 *  - fatturato e numero dipendenti NON sono campi diretti dell'azienda, ma
 *    vivono dentro balanceSheets.last (l'ultimo bilancio depositato).
 *
 * Prova comunque più percorsi plausibili per ogni campo (mantenendo i
 * fallback pre-esistenti) nel caso in produzione o per altre forme di
 * azienda la risposta vari leggermente — ma i percorsi confermati vengono
 * provati per primi. Non inventa MAI un valore assente.
 */
export function mappaRispostaAdvanced(raw: unknown, identificativoRichiesto: string): DatiAziendaRisolti | null {
  const contenitore = (raw as any)?.data ?? (raw as any)?.result ?? raw ?? {};
  const corpo = Array.isArray(contenitore) ? contenitore[0] : contenitore;
  if (!corpo || typeof corpo !== "object") return null;

  const ragioneSociale: string | undefined =
    corpo.companyName ?? corpo.businessName ?? corpo.ragioneSociale ?? corpo.name ?? corpo.denominazione;
  if (!ragioneSociale) return null;

  const pivaRaw: string | undefined =
    corpo.vatCode ?? corpo.piva ?? corpo.taxCode ?? corpo.taxId ?? corpo.fiscalCode ?? corpo.codiceFiscale;
  // Se la risposta non riporta esplicitamente la P.IVA, usa l'identificativo
  // con cui è stata chiesta SOLO se quello stesso identificativo È una
  // P.IVA (11 cifre) — altrimenti (un ID provider) non travisarlo da P.IVA.
  const piva = pivaRaw ?? (/^\d{11}$/.test(identificativoRichiesto) ? identificativoRichiesto : undefined);
  if (!piva) return null;

  const openApiId: string | null = corpo.id ?? corpo.companyId ?? corpo.providerId ?? null;

  const atecoRaw =
    corpo.atecoClassification?.ateco?.code ?? corpo.atecoClassification?.ateco2007?.code ?? corpo.ateco?.code ?? corpo.atecoCode ?? corpo.codiceAteco ?? null;

  const sede = corpo.address?.registeredOffice ?? corpo.registeredOffice ?? corpo.sedeLegale ?? corpo.address ?? {};
  const regioneRaw = sede.region?.description ?? sede.region ?? sede.regione ?? corpo.region ?? corpo.regione ?? null;
  const regione: string | null = typeof regioneRaw === "string" ? regioneRaw : null;
  const provincia: string | null = sede.province ?? sede.provincia ?? corpo.province ?? corpo.provincia ?? null;

  const bilancioUltimo = corpo.balanceSheets?.last ?? corpo.balanceSheet ?? corpo.financials ?? {};
  const fatturatoRaw = bilancioUltimo.turnover ?? corpo.revenue ?? corpo.fatturato ?? null;
  const dipendentiRaw = bilancioUltimo.employees ?? corpo.employees ?? corpo.numeroDipendenti ?? corpo.companySize?.employees ?? corpo.employeesCount ?? null;

  // PEC — il contatto che questa integrazione garantisce (§1 delle
  // specifiche: email ordinaria/telefono/sito NON sono garantiti da qui).
  const pec: string | null = corpo.pec ?? corpo.certifiedEmail ?? corpo.contacts?.pec ?? null;

  return {
    ragioneSociale: String(ragioneSociale).trim(),
    piva: String(piva).replace(/\s+/g, "").toUpperCase(),
    openApiId: openApiId ? String(openApiId) : null,
    ateco: atecoRaw ? String(atecoRaw).trim() : null,
    regione: regione ? regione.trim() : null,
    provincia: provincia ? String(provincia).trim() : null,
    fatturato: fatturatoRaw != null && Number.isFinite(Number(fatturatoRaw)) ? Number(fatturatoRaw) : null,
    numeroDipendenti: dipendentiRaw != null && Number.isFinite(Number(dipendentiRaw)) ? Number(dipendentiRaw) : null,
    pec: pec ? String(pec).trim() : null,
  };
}
