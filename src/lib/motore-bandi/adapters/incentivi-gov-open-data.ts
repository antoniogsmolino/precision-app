/**
 * Adapter Tier 0 — Incentivi.gov.it Open Data (specifica tecnica motore
 * bandi, §4). La fonte di discovery nazionale principale: JSON/CSV
 * ufficiale del catalogo, non HTML da interpretare — dati strutturati e
 * deterministici, niente selettori fragili come nel vecchio motore
 * (src/lib/monitoring/parsers/incentivi-gov-it.ts, che invece raschia
 * l'HTML del portale e resta finché quella fonte non viene migrata qui).
 *
 * NOTA IMPORTANTE SULLA CAPITALIZZAZIONE DEI CAMPI: questo ambiente non ha
 * accesso alla rete pubblica, quindi non ho potuto scaricare un JSON reale
 * da incentivi.gov.it/it/open-data per leggere i nomi ESATTI delle chiavi.
 * I candidati sotto sono presi verbatim dall'elenco campi documentato nella
 * specifica (§4) più le varianti più comuni per dataset PA (CKAN/Socrata:
 * spesso snake_case minuscolo). `leggiCampoGrezzo` (in ./tipi.ts) prova le
 * chiavi esatte e poi un confronto case/underscore-insensitive, quindi
 * regge piccole differenze di capitalizzazione — ma se la struttura reale
 * è sensibilmente diversa (es. nomi in inglese, nesting diverso) va
 * verificato e corretto qui al primo run reale, come già successo per i
 * selettori HTML di Invitalia/MIMIT in questa stessa sessione.
 *
 * URL della risorsa NON hardcodato qui (specifica, §103: "gli endpoint
 * devono risiedere nel Source Registry, non nel codice applicativo") —
 * viene letto da Fonte.url, configurabile dal team senza un nuovo deploy.
 */
import { createHash } from "node:crypto";
import type { TipoAgevolazione, TipoValoreMisura } from "@prisma/client";
import { parseImportoEuro, parsePercentuale } from "../../monitoring/parsers/shared";
import { campo, leggiCampoGrezzo, type BandoNormalizzato, type EsitoHealthCheck, type ItemGrezzo, type RisorsaScoperta, type SourceAdapter } from "./tipi";

const TIMEOUT_FETCH_MS = 30_000;
const HEADERS_FETCH = {
  "User-Agent": "SonarFinanzaAgevolata/1.0 (+https://www.molo4punto0.it; motore-bandi)",
  Accept: "application/json, text/csv;q=0.9, */*;q=0.5",
};

const CANDIDATI_CAMPO = {
  id: ["ID_Incentivo", "id_incentivo", "id"],
  titolo: ["Titolo", "titolo", "title"],
  descrizione: ["Descrizione", "descrizione", "description"],
  obiettivo: ["Obiettivo_Finalita", "obiettivo_finalita", "obiettivo"],
  dataApertura: ["Data_apertura", "data_apertura", "DataApertura"],
  dataChiusura: ["Data_chiusura", "data_chiusura", "DataChiusura"],
  noteAperturaChiusura: ["Note_di_apertura_chiusura", "note_di_apertura_chiusura"],
  formaAgevolazione: ["Forma_agevolazione", "forma_agevolazione"],
  costiAmmessi: ["Costi_Ammessi", "costi_ammessi"],
  spesaAmmessa: ["Spesa_ammessa", "spesa_ammessa", "Spesa_ammessa_massima"],
  agevolazioneConcedibile: ["Agevolazione_concedibile", "agevolazione_concedibile"],
  settoreAttivita: ["Settore_Attivita", "settore_attivita"],
  codiciAteco: ["Codici_ATECO", "codici_ateco", "ATECO"],
  regioni: ["Regioni", "regioni"],
  soggettoConcedente: ["Soggetto_Concedente", "soggetto_concedente", "Ente"],
  linkIstituzionale: ["Link_istituzionale", "link_istituzionale", "url"],
  altreCaratteristiche: ["Altre_caratteristiche", "altre_caratteristiche"],
  dataUltimoAggiornamento: ["Data_ultimo_aggiornamento", "data_ultimo_aggiornamento"],
} as const;

function testo(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function elenco(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Parsa una data in formato ISO (YYYY-MM-DD[THH:mm:ss]) — atteso per un dataset strutturato — con fallback dd/mm/yyyy per sicurezza. */
function parseDataOpenData(v: unknown): Date | null {
  const s = testo(v);
  if (!s) return null;
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s)) return iso;
  const italiana = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (italiana) {
    const [, gg, mm, aaaa] = italiana;
    const d = new Date(Number(aaaa), Number(mm) - 1, Number(gg));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Mappa il testo libero "Forma_agevolazione" sull'enum interno (4 valori) — un vocabolario più ricco richiederebbe di estendere TipoAgevolazione, deliberatamente rimandato: qui l'obiettivo è non buttare via il record se il testo non combacia esattamente. */
function mappaFormaAgevolazione(testoLibero: string | undefined): TipoAgevolazione {
  const t = (testoLibero ?? "").toLowerCase();
  if (/tasso\s*zero|tasso\s*agevolat/.test(t)) return "TASSO_ZERO";
  if (/credito\s*d'?imposta/.test(t)) return "CREDITO_IMPOSTA";
  if (/fondo\s*perduto|contributo\s*a\s*fondo|contributo\s*in\s*conto\s*capitale/.test(t)) return "FONDO_PERDUTO";
  return "MISTO";
}

function mappaTipoValore(percentuale: number | null, importoFisso: number | null): TipoValoreMisura {
  if (percentuale !== null) return "PERCENTUALE";
  if (importoFisso !== null) return "IMPORTO_FISSO";
  return "RANGE";
}

function normalizzaRecord(record: Record<string, unknown>): BandoNormalizzato {
  const idIncentivo = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.id]));
  const titoloTesto = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.titolo])) ?? "(titolo non disponibile)";
  const descrizioneTesto = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.descrizione]));
  const obiettivoTesto = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.obiettivo]));
  const noteAperturaChiusura = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.noteAperturaChiusura]));
  const linkIstituzionale = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.linkIstituzionale]));
  const soggettoConcedente = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.soggettoConcedente])) ?? "Ente non specificato";
  const altreCaratteristiche = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.altreCaratteristiche]));

  const dataAperturaGrezza = leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.dataApertura]);
  const dataChiusuraGrezza = leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.dataChiusura]);
  const dataApertura = parseDataOpenData(dataAperturaGrezza);
  const dataChiusura = parseDataOpenData(dataChiusuraGrezza);

  // Campi economici: nella specifica sono descritti come testo libero
  // ("Costi_Ammessi", "agevolazione concedibile"...), non numeri puliti —
  // qui si tenta l'estrazione con gli stessi parser euro/percentuale già
  // verificati nel motore esistente. Se il testo non contiene un numero
  // riconoscibile il campo resta null con confidence 0 (mai indovinato).
  const spesaAmmessaTesto = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.spesaAmmessa, ...CANDIDATI_CAMPO.costiAmmessi]));
  const agevolazioneTesto = testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.agevolazioneConcedibile]));
  const percentuale = agevolazioneTesto ? parsePercentuale(agevolazioneTesto) : null;
  const tettoMassimo = agevolazioneTesto ? parseImportoEuro(agevolazioneTesto) : null;
  const importoMax = spesaAmmessaTesto ? parseImportoEuro(spesaAmmessaTesto) : null;
  const importoFisso = percentuale === null && tettoMassimo === null ? importoMax : null;

  const ateco = elenco(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.codiciAteco]));
  const regioni = elenco(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.regioni])).filter(
    (r) => !/tutte\s*le\s*regioni|nazionale|italia/i.test(r),
  );

  const descrizioneEstesaTesto = [descrizioneTesto, obiettivoTesto, altreCaratteristiche].filter(Boolean).join("\n\n") || titoloTesto;

  // scadenzaStimata: true quando manca una data di chiusura affidabile —
  // la dashboard esistente la mostra come "da verificare" e la esclude
  // dagli alert di scadenza imminente (comportamento già in produzione,
  // src/lib/misure/stato.ts). Fallback a +180 giorni dall'apertura (o da
  // oggi) quando anche l'apertura manca, stesso pattern del vecchio motore.
  const scadenzaStimata = dataChiusura === null;
  const aperturaEffettiva = dataApertura ?? new Date();
  const scadenzaEffettiva = dataChiusura ?? new Date(aperturaEffettiva.getTime() + 180 * 24 * 60 * 60 * 1000);

  return {
    identificatoriEsterni: { incentiviGovId: idIncentivo },
    titolo: campo(titoloTesto, { estrattoTesto: titoloTesto }),
    ente: campo(soggettoConcedente, { estrattoTesto: soggettoConcedente }),
    descrizioneBreve: campo(descrizioneTesto ?? titoloTesto, { estrattoTesto: descrizioneTesto }),
    descrizioneEstesa: campo(descrizioneEstesaTesto, { estrattoTesto: descrizioneEstesaTesto }),
    dataApertura: campo(aperturaEffettiva, {
      confidence: dataApertura ? 1 : 0.3,
      estrattoTesto: testo(dataAperturaGrezza),
    }),
    dataScadenza: campo(scadenzaEffettiva, {
      confidence: dataChiusura ? 1 : 0.3,
      estrattoTesto: testo(dataChiusuraGrezza) ?? noteAperturaChiusura,
    }),
    scadenzaStimata,
    tipoAgevolazione: campo(mappaFormaAgevolazione(testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.formaAgevolazione]))), {
      confidence: 0.7,
      estrattoTesto: testo(leggiCampoGrezzo(record, [...CANDIDATI_CAMPO.formaAgevolazione])),
    }),
    tipoValore: campo(mappaTipoValore(percentuale, importoFisso), { confidence: 0.7 }),
    importoFisso: campo(importoFisso, { metodoEstrazione: "DERIVATO", confidence: importoFisso ? 0.6 : 0, estrattoTesto: spesaAmmessaTesto }),
    importoMin: campo<number>(null),
    importoMax: campo(importoMax, { confidence: importoMax ? 0.6 : 0, estrattoTesto: spesaAmmessaTesto }),
    percentuale: campo(percentuale, { confidence: percentuale ? 0.6 : 0, estrattoTesto: agevolazioneTesto }),
    tettoMassimo: campo(tettoMassimo, { confidence: tettoMassimo ? 0.6 : 0, estrattoTesto: agevolazioneTesto }),
    atecoAmmessi: campo(ateco, { confidence: ateco.length ? 0.8 : 0 }),
    regioniAmmesse: campo(regioni, { confidence: 0.8 }),
    linkFonteUfficiale: campo(linkIstituzionale ?? "https://www.incentivi.gov.it/it/open-data", {
      confidence: linkIstituzionale ? 1 : 0.2,
    }),
    // Deliberatamente null: la specifica (§28) avverte esplicitamente di
    // non dedurre stati come FUNDS_EXHAUSTED/PAUSED/CANCELLED da segnali
    // deboli. Senza un campo esplicito e affidabile per lo stato
    // dichiarato in questo dataset, meglio nessuno stato che uno inventato
    // — lo stato mostrato in dashboard resta comunque quello calcolato
    // dalle date da src/lib/misure/stato.ts.
    statoDichiarato: null,
  };
}

export const adapterIncentiviGovOpenData: SourceAdapter = {
  chiave: "incentivi-gov-open-data",

  async discover(fonte) {
    return [{ urlRisorsa: fonte.url, tipo: fonte.url.toLowerCase().endsWith(".csv") ? "OPEN_DATA_CSV" : "OPEN_DATA_JSON" }];
  },

  async fetch(item: RisorsaScoperta): Promise<ItemGrezzo> {
    const res = await fetch(item.urlRisorsa, {
      headers: HEADERS_FETCH,
      signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
    });
    const corpo = await res.text();
    return {
      urlRisorsa: item.urlRisorsa,
      fetchedAt: new Date(),
      statusCode: res.status,
      contentType: res.headers.get("content-type"),
      corpo,
    };
  },

  normalize(raw: ItemGrezzo): BandoNormalizzato[] {
    let record: unknown;
    try {
      record = JSON.parse(raw.corpo);
    } catch {
      // Non è JSON valido: probabilmente CSV, o un errore HTTP servito come
      // pagina HTML. Il CSV come formato di fallback (specifica, §4: "usare
      // CSV come fallback e confronto") non è ancora implementato in questo
      // adapter — primo obiettivo è il percorso JSON, il più comune per
      // dataset Open Data italiani. Nessun bando prodotto, mai un crash.
      return [];
    }

    const elencoRecord: unknown[] = Array.isArray(record)
      ? record
      : Array.isArray((record as any)?.data)
        ? (record as any).data
        : Array.isArray((record as any)?.results)
          ? (record as any).results
          : Array.isArray((record as any)?.items)
            ? (record as any).items
            : [];

    return elencoRecord.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null).map(normalizzaRecord);
  },

  async healthCheck(fonte): Promise<EsitoHealthCheck> {
    try {
      const res = await fetch(fonte.url, { method: "HEAD", signal: AbortSignal.timeout(10_000) }).catch(() =>
        fetch(fonte.url, { signal: AbortSignal.timeout(10_000) }),
      );
      if (!res.ok) return { healthStatus: "FAILING", dettaglio: `HTTP ${res.status}` };
      return { healthStatus: "HEALTHY", dettaglio: `HTTP ${res.status}` };
    } catch (err) {
      return { healthStatus: "FAILING", dettaglio: err instanceof Error ? err.message : "errore sconosciuto" };
    }
  },
};

export function hashRaw(corpo: string): string {
  return createHash("sha256").update(corpo).digest("hex");
}
