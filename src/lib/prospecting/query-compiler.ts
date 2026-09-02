import type { Misura } from "@prisma/client";
import type { ParametriSearch } from "./openapi-client";

/**
 * Traduce i requisiti STRUTTURATI di una misura (quelli già presenti nello
 * schema: atecoAmmessi, fatturatoMin/Max, dipendentiMin/Max) in uno o più
 * piani di query IT-search — non tutti i requisiti di una misura sono
 * traducibili in un filtro Search con significato equivalente (vedi §6
 * delle specifiche, "Prevenire esclusioni errate"): un filtro va applicato
 * a monte SOLO se la sua semantica è certa, altrimenti meglio una ricerca
 * più ampia e lasciare il controllo al motore di matching esistente
 * (src/lib/matching/engine.ts, valutaMatch) sui dati che arrivano da
 * Advanced.
 *
 * Requisiti tradotti (search_filter):
 *  - ATECO ammessi -> atecoCode (un segmento di query per codice, l'API
 *    esempio nelle specifiche non mostra un OR nativo — vedi §7: "per più
 *    territori, codici alternativi... compilare segmenti separati").
 *  - Fatturato min/max -> minTurnover/maxTurnover.
 *  - Dipendenti min/max -> minEmployees/maxEmployees.
 *
 * Requisiti VOLUTAMENTE non tradotti in Search (restano "da verificare"
 * sul match, non un'esclusione a monte):
 *  - regioniAmmesse: il parametro di esempio nelle specifiche è
 *    `province` (codice provincia a 2 lettere, es. "CT"), non regione.
 *    Misura.regioniAmmesse contiene nomi di REGIONE ("Sicilia"), non
 *    province — non esiste qui una mappa regione -> tutti i codici
 *    provincia di quella regione verificata, e improvvisarla rischia di
 *    escludere a monte aziende ammissibili per un parametro API sbagliato
 *    (esattamente il caso che le specifiche vietano esplicitamente).
 *    Verificato invece a valle da valutaMatch sui dati Advanced (che
 *    include la sede) quando l'azienda arriva ad essere arricchita.
 *  - atecoEsclusi: IT-search non ha, nelle specifiche fornite, un
 *    parametro di esclusione ATECO — filtrarli lato query rischierebbe
 *    di inventare una sintassi mai confermata. Restano verificati da
 *    valutaMatch (che già gestisce atecoEsclusi con priorità sugli
 *    ammessi).
 */
export interface PianoQuery {
  parametri: ParametriSearch;
  /** Motivo leggibile del segmento (utile in UI/log — es. "ATECO 62.01"). */
  descrizione: string;
}

function normalizzaAteco(codice: string): string {
  return codice.replace(/[.\s]/g, "");
}

export function compilaPianoQuery(misura: Pick<Misura, "atecoAmmessi" | "fatturatoMin" | "fatturatoMax" | "dipendentiMin" | "dipendentiMax">, limitePerPagina = 100): PianoQuery[] {
  const base: ParametriSearch = {
    minTurnover: misura.fatturatoMin != null ? Number(misura.fatturatoMin) : undefined,
    maxTurnover: misura.fatturatoMax != null ? Number(misura.fatturatoMax) : undefined,
    minEmployees: misura.dipendentiMin ?? undefined,
    maxEmployees: misura.dipendentiMax ?? undefined,
    limit: limitePerPagina,
    skip: 0,
  };

  if (misura.atecoAmmessi.length === 0) {
    return [{ parametri: base, descrizione: "Nessun filtro ATECO (tutti i settori)" }];
  }

  // Un segmento di query per ciascun codice ATECO ammesso — evita di
  // sovrapporre segmenti (§13: "evitare segmenti sovrapposti quando
  // possibile") mantenendo comunque una query per codice, dedup dei
  // risultati a carico del chiamante (engine.ts).
  return misura.atecoAmmessi.map((codice) => ({
    parametri: { ...base, atecoCode: normalizzaAteco(codice) },
    descrizione: `ATECO ${codice}`,
  }));
}
