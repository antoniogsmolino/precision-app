/**
 * Adapter Tier 0 — Incentivi.gov.it Open Data (specifica tecnica motore
 * bandi, §4). La fonte di discovery nazionale principale: JSON ufficiale
 * del catalogo, non HTML da interpretare — dati strutturati e
 * deterministici, niente selettori fragili come nel vecchio motore
 * (src/lib/monitoring/parsers/incentivi-gov-it.ts, che invece raschia
 * l'HTML del portale e resta finché quella fonte non viene migrata qui).
 *
 * MAPPATURA CAMPI VERIFICATA su un export reale di 5.837 record fornito
 * dal team (02/09/2026) — non più un best-effort sui nomi documentati
 * nella specifica: i campi elencati sotto sono quelli VERI del JSON
 * ufficiale (leggermente diversi dai nomi della specifica — es. l'importo
 * non è testo libero "Costi_Ammessi"/"agevolazione concedibile" ma quattro
 * campi numerici puliti *_min/*_max). URL della risorsa NON hardcodato
 * qui (specifica, §103): letto da Fonte.url, configurabile dal team senza
 * un nuovo deploy — al momento non ancora noto in modo automatizzato
 * (nessun accesso di rete da questo ambiente), da impostare non appena
 * disponibile il link diretto al file JSON.
 */
import { createHash } from "node:crypto";
import type { TipoAgevolazione, TipoValoreMisura } from "@prisma/client";
import { campo, leggiCampoGrezzo, type BandoNormalizzato, type EsitoHealthCheck, type ItemGrezzo, type RisorsaScoperta, type SourceAdapter } from "./tipi";

const TIMEOUT_FETCH_MS = 30_000;
const HEADERS_FETCH = {
  "User-Agent": "SonarFinanzaAgevolata/1.0 (+https://www.molo4punto0.it; motore-bandi)",
  Accept: "application/json, text/csv;q=0.9, */*;q=0.5",
};

/** Nomi di campo esatti confermati sull'export reale — vedi nota in cima al file. */
const CAMPI = {
  id: ["ID_Incentivo"],
  titolo: ["Titolo"],
  descrizione: ["Descrizione"],
  obiettivo: ["Obiettivo_Finalita"],
  dataApertura: ["Data_apertura"],
  dataChiusura: ["Data_chiusura"],
  formaAgevolazione: ["Forma_agevolazione"],
  spesaAmmessaMin: ["Spesa_Ammessa_min"],
  spesaAmmessaMax: ["Spesa_Ammessa_max"],
  agevolazioneMin: ["Agevolazione_Concedibile_min"],
  agevolazioneMax: ["Agevolazione_Concedibile_max"],
  settoreAttivita: ["Settore_Attivita"],
  codiciAteco: ["Codici_ATECO"],
  regioni: ["Regioni"],
  soggettoConcedente: ["Soggetto_Concedente"],
  baseNormativa: ["Base_normativa_primaria"],
  provvedimentoAttuativo: ["Provvedimento_attuativo"],
  linkIstituzionale: ["Link_istituzionale"],
  dimensioni: ["Dimensioni"],
  tipologiaSoggetto: ["Tipologia_Soggetto"],
} as const;

/**
 * Vocabolario di Forma_agevolazione CHIUSO e verificato sull'intero export
 * reale (6 valori, nessun altro osservato su 5.837 record). Confidence
 * alta perché è un confronto esatto contro valori confermati, non un
 * indovinello su testo libero — un valore non riconosciuto (portale che
 * introduce una nuova categoria) ricade su MISTO con confidence bassa
 * invece di un match sbagliato silenzioso.
 */
const VOCABOLARIO_FORMA_AGEVOLAZIONE: Record<string, TipoAgevolazione> = {
  "contributo/fondo perduto": "FONDO_PERDUTO",
  "agevolazione fiscale": "CREDITO_IMPOSTA",
  // Le tre forme sotto (prestito rimborsabile, capitale di rischio,
  // garanzia, riduzione contributi previdenziali) non hanno una categoria
  // dedicata nell'enum interno (4 valori) — MISTO è la scelta onesta,
  // preferibile a forzarle dentro TASSO_ZERO/CREDITO_IMPOSTA solo perché
  // sono le uniche altre opzioni disponibili.
  "prestito/anticipo rimborsabile": "MISTO",
  "capitale di rischio": "MISTO",
  "interventi a garanzia": "MISTO",
  "riduzione dei contributi di previdenza sociale": "MISTO",
};

function testo(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

/** Le liste della fonte reale sono array JSON, non stringhe delimitate — Array.isArray è il percorso vero, il resto è un fallback difensivo. */
function elenco(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

function testoElenco(v: unknown): string | undefined {
  const l = elenco(v);
  return l.length > 0 ? l.join(", ") : undefined;
}

/** Numero pulito dai 4 campi economici (confermato sempre numerico o assente su tutto l'export reale, mai testo libero). */
function numero(v: unknown): number | null {
  const s = testo(v);
  if (s === undefined) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDataOpenData(v: unknown): Date | null {
  const s = testo(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const italiana = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (italiana) {
    const [, gg, mm, aaaa] = italiana;
    const d = new Date(Number(aaaa), Number(mm) - 1, Number(gg));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function mappaFormaAgevolazione(valori: string[]): { tipo: TipoAgevolazione; confidence: number; estratto?: string } {
  const primo = valori[0];
  if (!primo) return { tipo: "MISTO", confidence: 0 };
  const mappato = VOCABOLARIO_FORMA_AGEVOLAZIONE[primo.toLowerCase().trim()];
  return mappato
    ? { tipo: mappato, confidence: 0.95, estratto: primo }
    : { tipo: "MISTO", confidence: 0.4, estratto: primo }; // valore non nel vocabolario noto: non inventare una categoria specifica
}

/** "Tutti i settori economici..." non è un codice ATECO — nessuna restrizione, non un elenco con un elemento fasullo. */
function normalizzaAteco(testoGrezzo: string | undefined): string[] {
  if (!testoGrezzo) return [];
  if (/tutti\s+i\s+(settori|codici)/i.test(testoGrezzo)) return [];
  return testoGrezzo
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\d/.test(s)); // scarta eventuali frammenti di testo libero residui, tiene solo ciò che inizia con un codice numerico
}

function normalizzaRecord(record: Record<string, unknown>): BandoNormalizzato {
  const idIncentivo = testo(leggiCampoGrezzo(record, [...CAMPI.id]));
  const titoloTesto = testo(leggiCampoGrezzo(record, [...CAMPI.titolo])) ?? "(titolo non disponibile)";
  const descrizioneTesto = testo(leggiCampoGrezzo(record, [...CAMPI.descrizione]));
  const obiettivoTesto = testoElenco(leggiCampoGrezzo(record, [...CAMPI.obiettivo]));
  const linkIstituzionale = testo(leggiCampoGrezzo(record, [...CAMPI.linkIstituzionale]));
  const soggettoConcedente = testo(leggiCampoGrezzo(record, [...CAMPI.soggettoConcedente])) ?? "Ente non specificato";
  const baseNormativa = testo(leggiCampoGrezzo(record, [...CAMPI.baseNormativa]));
  const provvedimento = testo(leggiCampoGrezzo(record, [...CAMPI.provvedimentoAttuativo]));
  const dimensioniTesto = testoElenco(leggiCampoGrezzo(record, [...CAMPI.dimensioni]));
  const tipologiaSoggettoTesto = testoElenco(leggiCampoGrezzo(record, [...CAMPI.tipologiaSoggetto]));

  const dataAperturaGrezza = leggiCampoGrezzo(record, [...CAMPI.dataApertura]);
  const dataChiusuraGrezza = leggiCampoGrezzo(record, [...CAMPI.dataChiusura]);
  const dataApertura = parseDataOpenData(dataAperturaGrezza);
  const dataChiusura = parseDataOpenData(dataChiusuraGrezza);

  const spesaMin = numero(leggiCampoGrezzo(record, [...CAMPI.spesaAmmessaMin]));
  const spesaMax = numero(leggiCampoGrezzo(record, [...CAMPI.spesaAmmessaMax]));
  const agevolazioneMin = numero(leggiCampoGrezzo(record, [...CAMPI.agevolazioneMin]));
  const agevolazioneMax = numero(leggiCampoGrezzo(record, [...CAMPI.agevolazioneMax]));

  // Il dataset non fornisce una percentuale esplicita di intensità di
  // aiuto — solo importi min/max. Rappresentare il valore come RANGE
  // sull'agevolazione concedibile (o importo fisso se min==max) è più
  // fedele alla fonte che inventare una percentuale derivata (specifica,
  // §23: "mai derivare automaticamente grant_max da una percentuale se il
  // bando non lo permette esplicitamente" — vale anche al contrario).
  const agevolazioneEffettiva = agevolazioneMax ?? spesaMax;
  const agevolazioneMinEffettiva = agevolazioneMin ?? spesaMin;
  const importoFisso = agevolazioneEffettiva !== null && agevolazioneMinEffettiva === agevolazioneEffettiva ? agevolazioneEffettiva : null;
  const tipoValore: TipoValoreMisura = importoFisso !== null ? "IMPORTO_FISSO" : agevolazioneEffettiva !== null ? "RANGE" : "RANGE";

  const ateco = normalizzaAteco(testo(leggiCampoGrezzo(record, [...CAMPI.codiciAteco])));
  const regioni = elenco(leggiCampoGrezzo(record, [...CAMPI.regioni]));

  const forma = mappaFormaAgevolazione(elenco(leggiCampoGrezzo(record, [...CAMPI.formaAgevolazione])));

  const descrizioneEstesaTesto =
    [
      descrizioneTesto,
      obiettivoTesto ? `Finalità: ${obiettivoTesto}` : undefined,
      dimensioniTesto ? `Dimensioni ammesse: ${dimensioniTesto}` : undefined,
      tipologiaSoggettoTesto ? `Tipologia soggetto: ${tipologiaSoggettoTesto}` : undefined,
      baseNormativa ? `Base normativa: ${baseNormativa}` : undefined,
      provvedimento && provvedimento !== baseNormativa ? `Provvedimento attuativo: ${provvedimento}` : undefined,
    ]
      .filter(Boolean)
      .join("\n\n") || titoloTesto;

  const scadenzaStimata = dataChiusura === null;
  // Fallback quando manca Data_apertura: MAI "oggi" come unico default —
  // per un bando storico già chiuso (Data_chiusura nel passato) "oggi"
  // sarebbe successivo alla chiusura, violando apertura<=scadenza per un
  // motivo che non ha niente a che fare con i dati reali (trovato sull'export
  // reale: 8/5837 record con Data_apertura assente e Data_chiusura passata,
  // scartati dal validatore per questo). Se c'è una chiusura nota, usarla
  // anche come apertura stimata (stesso giorno, confidence bassa) è più
  // corretto di un fallback assoluto a "oggi".
  const aperturaEffettiva = dataApertura ?? dataChiusura ?? new Date();
  const scadenzaEffettiva = dataChiusura ?? new Date(aperturaEffettiva.getTime() + 180 * 24 * 60 * 60 * 1000);

  return {
    identificatoriEsterni: { incentiviGovId: idIncentivo },
    titolo: campo(titoloTesto, { estrattoTesto: titoloTesto }),
    ente: campo(soggettoConcedente, { estrattoTesto: soggettoConcedente }),
    descrizioneBreve: campo(descrizioneTesto ?? titoloTesto, { estrattoTesto: descrizioneTesto }),
    descrizioneEstesa: campo(descrizioneEstesaTesto, { estrattoTesto: descrizioneEstesaTesto }),
    dataApertura: campo(aperturaEffettiva, { confidence: dataApertura ? 1 : 0.3, estrattoTesto: testo(dataAperturaGrezza) }),
    dataScadenza: campo(scadenzaEffettiva, { confidence: dataChiusura ? 1 : 0.3, estrattoTesto: testo(dataChiusuraGrezza) }),
    scadenzaStimata,
    tipoAgevolazione: campo(forma.tipo, { confidence: forma.confidence, estrattoTesto: forma.estratto }),
    tipoValore: campo(tipoValore, { confidence: agevolazioneEffettiva !== null ? 0.9 : 0.3 }),
    importoFisso: campo(importoFisso, { confidence: importoFisso !== null ? 0.95 : 0 }),
    importoMin: campo(importoFisso === null ? agevolazioneMinEffettiva : null, { confidence: importoFisso === null && agevolazioneMinEffettiva !== null ? 0.95 : 0 }),
    importoMax: campo(importoFisso === null ? agevolazioneEffettiva : null, { confidence: importoFisso === null && agevolazioneEffettiva !== null ? 0.95 : 0 }),
    percentuale: campo<number>(null), // non fornita dalla fonte — onestamente assente, non derivata
    tettoMassimo: campo(agevolazioneEffettiva, { confidence: agevolazioneEffettiva !== null ? 0.95 : 0 }),
    atecoAmmessi: campo(ateco, { confidence: ateco.length ? 0.9 : 0 }),
    regioniAmmesse: campo(regioni, { confidence: regioni.length ? 0.95 : 0 }),
    linkFonteUfficiale: campo(linkIstituzionale ?? "https://www.incentivi.gov.it/it/open-data", { confidence: linkIstituzionale ? 1 : 0.2 }),
    // Deliberatamente null: la specifica (§28) avverte di non dedurre
    // stati come FUNDS_EXHAUSTED/PAUSED/CANCELLED da segnali deboli. Il
    // dataset non ha un campo di stato esplicito — lo stato mostrato in
    // dashboard resta quello calcolato dalle date da src/lib/misure/stato.ts.
    statoDichiarato: null,
  };
}

export const adapterIncentiviGovOpenData: SourceAdapter = {
  chiave: "incentivi-gov-open-data",

  async discover(fonte) {
    return [{ urlRisorsa: fonte.url, tipo: fonte.url.toLowerCase().endsWith(".csv") ? "OPEN_DATA_CSV" : "OPEN_DATA_JSON" }];
  },

  async fetch(item: RisorsaScoperta): Promise<ItemGrezzo> {
    const res = await fetch(item.urlRisorsa, { headers: HEADERS_FETCH, signal: AbortSignal.timeout(TIMEOUT_FETCH_MS) });
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
      // pagina HTML. Il CSV come formato di fallback (specifica, §4) non è
      // ancora implementato in questo adapter. Nessun bando prodotto, mai
      // un crash.
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
