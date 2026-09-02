import type { HealthStatus, StatoDichiaratoBando, TipoAgevolazione, TipoValoreMisura } from "@prisma/client";

/**
 * Contratto adapter del motore bandi (specifica tecnica motore nazionale
 * bandi, §12: discover/fetch/normalize/healthCheck). Adattato al caso
 * concreto delle fonti Open Data bulk (un'unica risorsa JSON/CSV con
 * centinaia di record, non pagine singole da scoprire una a una): qui
 * `discover` restituisce la risorsa stessa da scaricare, `fetch` la
 * scarica, `normalize` la spacchetta in N bandi. Un adapter per una fonte
 * "una pagina = un bando" (fonti dirette, Regioni...) implementerà lo
 * stesso contratto con `discover` che restituisce N item invece di 1 —
 * l'interfaccia non cambia.
 */
export interface RisorsaScoperta {
  urlRisorsa: string;
  tipo: "OPEN_DATA_JSON" | "OPEN_DATA_CSV" | "ALTRO";
}

export interface ItemGrezzo {
  urlRisorsa: string;
  fetchedAt: Date;
  statusCode: number | null;
  contentType: string | null;
  /** Contenuto testuale raw — quello che finisce, invariato, in RawSnapshot.corpo. */
  corpo: string;
}

/**
 * Campo con evidenza (specifica, §26 "evidence-first extraction" — la
 * regola più importante della specifica): mai un valore nudo, sempre
 * accompagnato da quanto siamo sicuri della fonte e da cosa lo dimostra.
 * Per un adapter Open Data ufficiale il valore letto direttamente dal
 * record strutturato ha `metodoEstrazione: "OPEN_DATA"` e confidence alta
 * (il dato non è "interpretato", è quello che l'ente ha dichiarato); un
 * valore calcolato da altri campi (es. tettoMassimo derivato da percentuale
 * + spesa massima) ha `metodoEstrazione: "DERIVATO"` e confidence più bassa
 * — mai spacciato per esplicito.
 */
export interface CampoConEvidenza<T> {
  valore: T | null;
  confidence: number; // 0..1
  metodoEstrazione: "OPEN_DATA" | "DERIVATO" | "MANUALE";
  /** Valore grezzo così come appariva nel record sorgente, per audit/evidence. */
  estrattoTesto?: string;
}

function campo<T>(
  valore: T | null,
  opts: { confidence?: number; metodoEstrazione?: CampoConEvidenza<T>["metodoEstrazione"]; estrattoTesto?: string } = {},
): CampoConEvidenza<T> {
  return {
    valore,
    confidence: opts.confidence ?? (valore === null ? 0 : 1),
    metodoEstrazione: opts.metodoEstrazione ?? "OPEN_DATA",
    estrattoTesto: opts.estrattoTesto,
  };
}
export { campo };

/**
 * Bando normalizzato nello schema canonico del motore, prima di essere
 * scritto su Misura+Evidence dalla pipeline di ingest
 * (src/lib/motore-bandi/ingest.ts). Ogni campo rilevante porta la propria
 * evidenza — l'ingest scrive un `Evidence` per ciascuno.
 */
export interface BandoNormalizzato {
  /** Almeno uno dei tre dovrebbe essere presente per le fonti Tier 0/1 — chiave di deduplicazione "hard identifier" (specifica, §30.1). */
  identificatoriEsterni: { incentiviGovId?: string; rnaCar?: string; sianCar?: string };

  titolo: CampoConEvidenza<string>;
  ente: CampoConEvidenza<string>;
  descrizioneBreve: CampoConEvidenza<string>;
  descrizioneEstesa: CampoConEvidenza<string>;

  dataApertura: CampoConEvidenza<Date>;
  dataScadenza: CampoConEvidenza<Date>;
  /** true quando dataScadenza è un fallback (nessuna data affidabile trovata), non una scadenza confermata. */
  scadenzaStimata: boolean;

  tipoAgevolazione: CampoConEvidenza<TipoAgevolazione>;
  tipoValore: CampoConEvidenza<TipoValoreMisura>;
  importoFisso: CampoConEvidenza<number>;
  importoMin: CampoConEvidenza<number>;
  importoMax: CampoConEvidenza<number>;
  percentuale: CampoConEvidenza<number>;
  tettoMassimo: CampoConEvidenza<number>;

  atecoAmmessi: CampoConEvidenza<string[]>;
  regioniAmmesse: CampoConEvidenza<string[]>;

  linkFonteUfficiale: CampoConEvidenza<string>;
  statoDichiarato: StatoDichiaratoBando | null;
}

export interface EsitoHealthCheck {
  healthStatus: HealthStatus;
  dettaglio: string;
}

export interface SourceAdapter {
  /** Chiave stabile — deve combaciare con Fonte.adapterKey. */
  chiave: string;
  discover(fonte: { url: string }): Promise<RisorsaScoperta[]>;
  fetch(item: RisorsaScoperta): Promise<ItemGrezzo>;
  /** Un fetch bulk può produrre più bandi: la firma restituisce sempre un array. */
  normalize(raw: ItemGrezzo): BandoNormalizzato[];
  healthCheck(fonte: { url: string }): Promise<EsitoHealthCheck>;
}

/**
 * Cerca un valore in un record JSON provando più varianti del nome campo:
 * prima le chiavi esatte documentate, poi un confronto case/underscore/
 * spazio-insensitive. Necessario perché questo ambiente non ha accesso
 * internet per verificare la capitalizzazione esatta delle chiavi reali
 * dell'Open Data — vedi il commento in cima a incentivi-gov-open-data.ts.
 */
export function leggiCampoGrezzo(record: Record<string, unknown>, candidati: string[]): unknown {
  for (const chiave of candidati) {
    const v = record[chiave];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  const normalizza = (s: string) => s.toLowerCase().replace(/[_\s-]/g, "");
  const chiaviRecord = Object.keys(record);
  for (const candidato of candidati) {
    const target = normalizza(candidato);
    const trovata = chiaviRecord.find((k) => normalizza(k) === target);
    if (trovata) {
      const v = record[trovata];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}
