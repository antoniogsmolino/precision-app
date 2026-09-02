import type { DatiAziendaRisolti } from "./cache";

/**
 * Legge i campi che servono da una risposta IT-advanced la cui struttura
 * esatta non è stata verificata contro l'API reale (nessun accesso di
 * rete da questo ambiente — stesso limite dei parser di monitoraggio
 * fonti, vedi README). Prova più percorsi plausibili per ogni campo
 * invece di assumerne uno solo: un'unica discrepanza di naming non deve
 * far fallire tutto il resto. Non inventa MAI un valore assente.
 *
 * Se in produzione una risposta 200 reale torna con questi campi vuoti,
 * il problema è quasi certamente qui — un esempio reale di risposta
 * (anche con dati anonimizzati) basta a correggere la mappatura in pochi
 * minuti, vedi schema ufficiale: console.openapi.com/oas/it/company.openapi.json
 */
export function mappaRispostaAdvanced(raw: unknown, identificativoRichiesto: string): DatiAziendaRisolti | null {
  const corpo = (raw as any)?.data ?? (raw as any)?.result ?? raw ?? {};

  const ragioneSociale: string | undefined =
    corpo.companyName ?? corpo.businessName ?? corpo.ragioneSociale ?? corpo.name ?? corpo.denominazione;
  if (!ragioneSociale) return null;

  const pivaRaw: string | undefined = corpo.vatCode ?? corpo.piva ?? corpo.taxId ?? corpo.fiscalCode ?? corpo.codiceFiscale;
  // Se la risposta non riporta esplicitamente la P.IVA, usa l'identificativo
  // con cui è stata chiesta SOLO se quello stesso identificativo È una
  // P.IVA (11 cifre) — altrimenti (un ID provider) non travisarlo da P.IVA.
  const piva = pivaRaw ?? (/^\d{11}$/.test(identificativoRichiesto) ? identificativoRichiesto : undefined);
  if (!piva) return null;

  const openApiId: string | null = corpo.id ?? corpo.companyId ?? corpo.providerId ?? null;

  const atecoRaw = corpo.atecoClassification?.ateco2007?.code ?? corpo.ateco?.code ?? corpo.atecoCode ?? corpo.codiceAteco ?? corpo.ateco ?? null;

  const sede = corpo.registeredOffice ?? corpo.sedeLegale ?? corpo.address ?? {};
  const regione: string | null = sede.region ?? sede.regione ?? corpo.region ?? corpo.regione ?? null;
  const provincia: string | null = sede.province ?? sede.provincia ?? corpo.province ?? corpo.provincia ?? null;

  const fatturatoRaw = corpo.revenue ?? corpo.fatturato ?? corpo.balanceSheet?.revenue ?? corpo.financials?.revenue ?? null;
  const dipendentiRaw = corpo.employees ?? corpo.numeroDipendenti ?? corpo.companySize?.employees ?? corpo.employeesCount ?? null;

  // PEC — il contatto che questa integrazione garantisce (§1 delle
  // specifiche: email ordinaria/telefono/sito NON sono garantiti da qui).
  const pec: string | null = corpo.pec ?? corpo.certifiedEmail ?? corpo.contacts?.pec ?? null;

  return {
    ragioneSociale: String(ragioneSociale).trim(),
    piva: String(piva).replace(/\s+/g, "").toUpperCase(),
    openApiId: openApiId ? String(openApiId) : null,
    ateco: atecoRaw ? String(atecoRaw).trim() : null,
    regione: regione ? String(regione).trim() : null,
    provincia: provincia ? String(provincia).trim() : null,
    fatturato: fatturatoRaw != null && Number.isFinite(Number(fatturatoRaw)) ? Number(fatturatoRaw) : null,
    numeroDipendenti: dipendentiRaw != null && Number.isFinite(Number(dipendentiRaw)) ? Number(dipendentiRaw) : null,
    pec: pec ? String(pec).trim() : null,
  };
}
