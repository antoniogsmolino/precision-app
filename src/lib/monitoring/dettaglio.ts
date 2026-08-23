import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { HEADERS_FETCH } from "./http";
import { verificaRobotsTxt } from "./robots";
import { parseDataItaliana, parseImportoEuro, testoPulito } from "./parsers/shared";
import type { MisuraGrezza } from "./types";
import type { TipoAgevolazione, TipoValoreMisura } from "@prisma/client";

/**
 * Arricchimento dalla pagina di DETTAGLIO di ogni misura (non solo la
 * pagina elenco): la pagina elenco dà titolo e poco altro, i requisiti
 * veri (importo, scadenza, ATECO, fatturato, dipendenti, documenti) sono
 * quasi sempre scritti solo nella pagina di dettaglio del singolo bando —
 * senza questo passaggio il match con i prospect non può funzionare
 * (mancano i campi su cui il motore di matching confronta). Due livelli,
 * corroboranti non sostitutivi l'uno dell'altro:
 *
 *  1. Le stesse regex già usate sulla pagina elenco (scadenza, importo),
 *     riapplicate al testo — molto più ricco — della pagina di dettaglio.
 *     Funziona sempre, non richiede AI.
 *  2. Se ANTHROPIC_API_KEY è configurata, un'estrazione strutturata più
 *     ricca (ATECO, fatturato, dipendenti, documenti richiesti...) che le
 *     regex non possono fare in modo affidabile su HTML così eterogeneo.
 *
 * Fail-open ad ogni livello: pagina irraggiungibile, robots.txt che nega,
 * timeout, risposta AI non interpretabile -> si tiene quello che il
 * parser di fonte aveva già ricavato dalla pagina elenco, non si perde
 * mai una misura per un problema di questo arricchimento.
 */
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const TIMEOUT_DETTAGLIO_MS = 15_000;
const LUNGHEZZA_TESTO_MAX_AI = 6000;

const TIPI_AGEVOLAZIONE_VALIDI: readonly TipoAgevolazione[] = ["FONDO_PERDUTO", "TASSO_ZERO", "CREDITO_IMPOSTA", "MISTO"];
const TIPI_VALORE_VALIDI: readonly TipoValoreMisura[] = ["IMPORTO_FISSO", "RANGE", "PERCENTUALE"];

async function scaricaTestoDettaglio(url: string): Promise<string | null> {
  try {
    const robots = await verificaRobotsTxt(url);
    if (!robots.consentito) return null;

    const res = await fetch(url, { headers: HEADERS_FETCH, signal: AbortSignal.timeout(TIMEOUT_DETTAGLIO_MS) });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, noscript, svg").remove();
    const testo = testoPulito($("body"));
    return testo.length > 100 ? testo : null;
  } catch {
    return null;
  }
}

function arricchisciConRegex(testo: string, base: MisuraGrezza): MisuraGrezza {
  const risultato = { ...base };

  if (risultato.scadenzaStimata !== false) {
    const m = testo.match(
      /(?:scadenza|entro il|termine ultimo|chiude il|le domande[^.]{0,30}entro)[^\d]{0,25}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i,
    );
    const data = m ? parseDataItaliana(m[1]) : null;
    if (data) {
      risultato.dataScadenza = data;
      risultato.scadenzaStimata = false;
    }
  }

  if (risultato.importoFisso == null && risultato.importoMin == null && risultato.importoMax == null) {
    const importo = parseImportoEuro(testo);
    if (importo) risultato.importoFisso = importo;
  }

  return risultato;
}

function costruisciPromptEstrazione(testo: string, titolo: string): string {
  return `Estrai dal testo seguente (pagina di dettaglio di un bando/incentivo italiano, titolo: "${titolo}") i requisiti reali della misura, SOLO se scritti esplicitamente nel testo. Non dedurre, non usare convenzioni tipiche di altri bandi, non inventare: se un'informazione non è scritta, usa null per quel campo.

TESTO DELLA PAGINA:
"""
${testo}
"""

Rispondi SOLO con un oggetto JSON (nessun testo prima o dopo) con questa struttura esatta:
{
  "descrizioneEstesa": string o null (2-4 frasi che riassumono cosa offre la misura),
  "dataApertura": "YYYY-MM-DD" o null,
  "dataScadenza": "YYYY-MM-DD" o null,
  "tipoAgevolazione": uno tra "FONDO_PERDUTO", "TASSO_ZERO", "CREDITO_IMPOSTA", "MISTO", o null,
  "tipoValore": uno tra "IMPORTO_FISSO", "RANGE", "PERCENTUALE", o null,
  "importoFisso": numero o null,
  "importoMin": numero o null,
  "importoMax": numero o null,
  "percentuale": numero (0-100) o null,
  "tettoMassimo": numero o null,
  "atecoAmmessi": array di stringhe (codici ATECO, es. "62.01") o null,
  "atecoEsclusi": array di stringhe o null,
  "regioniAmmesse": array di nomi regione italiani o null (null/vuoto = nessuna restrizione geografica indicata),
  "fatturatoMin": numero o null,
  "fatturatoMax": numero o null,
  "dipendentiMin": numero o null,
  "dipendentiMax": numero o null,
  "altriRequisiti": string o null (altri requisiti di ammissibilità in sintesi),
  "documentiRichiesti": array di stringhe o null
}`;
}

function numeroOppureNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function arrayStringheOppureNull(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

async function estraiConAI(testo: string, titolo: string): Promise<Partial<MisuraGrezza> | null> {
  if (!client) return null;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: costruisciPromptEstrazione(testo.slice(0, LUNGHEZZA_TESTO_MAX_AI), titolo) }],
    });

    const blocco = response.content.find((b) => b.type === "text");
    const testoRisposta = blocco && "text" in blocco ? blocco.text : "";
    const match = testoRisposta.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const dati = JSON.parse(match[0]);
    if (typeof dati !== "object" || dati === null) return null;

    const risultato: Partial<MisuraGrezza> = {};

    if (typeof dati.descrizioneEstesa === "string" && dati.descrizioneEstesa.trim()) {
      risultato.descrizioneEstesa = dati.descrizioneEstesa.trim();
    }
    const apertura = typeof dati.dataApertura === "string" ? new Date(dati.dataApertura) : null;
    if (apertura && !Number.isNaN(apertura.getTime())) risultato.dataApertura = apertura;

    const scadenza = typeof dati.dataScadenza === "string" ? new Date(dati.dataScadenza) : null;
    if (scadenza && !Number.isNaN(scadenza.getTime())) {
      risultato.dataScadenza = scadenza;
      risultato.scadenzaStimata = false;
    }

    if (TIPI_AGEVOLAZIONE_VALIDI.includes(dati.tipoAgevolazione)) risultato.tipoAgevolazione = dati.tipoAgevolazione;
    if (TIPI_VALORE_VALIDI.includes(dati.tipoValore)) risultato.tipoValore = dati.tipoValore;

    const importoFisso = numeroOppureNull(dati.importoFisso);
    if (importoFisso != null) risultato.importoFisso = importoFisso;
    const importoMin = numeroOppureNull(dati.importoMin);
    if (importoMin != null) risultato.importoMin = importoMin;
    const importoMax = numeroOppureNull(dati.importoMax);
    if (importoMax != null) risultato.importoMax = importoMax;
    const percentuale = numeroOppureNull(dati.percentuale);
    if (percentuale != null) risultato.percentuale = percentuale;
    const tettoMassimo = numeroOppureNull(dati.tettoMassimo);
    if (tettoMassimo != null) risultato.tettoMassimo = tettoMassimo;
    const fatturatoMin = numeroOppureNull(dati.fatturatoMin);
    if (fatturatoMin != null) risultato.fatturatoMin = fatturatoMin;
    const fatturatoMax = numeroOppureNull(dati.fatturatoMax);
    if (fatturatoMax != null) risultato.fatturatoMax = fatturatoMax;
    const dipendentiMin = numeroOppureNull(dati.dipendentiMin);
    if (dipendentiMin != null) risultato.dipendentiMin = dipendentiMin;
    const dipendentiMax = numeroOppureNull(dati.dipendentiMax);
    if (dipendentiMax != null) risultato.dipendentiMax = dipendentiMax;

    const ateco = arrayStringheOppureNull(dati.atecoAmmessi);
    if (ateco) risultato.atecoAmmessi = ateco;
    const atecoEsclusi = arrayStringheOppureNull(dati.atecoEsclusi);
    if (atecoEsclusi) risultato.atecoEsclusi = atecoEsclusi;
    const regioni = arrayStringheOppureNull(dati.regioniAmmesse);
    if (regioni) risultato.regioniAmmesse = regioni;
    const documenti = arrayStringheOppureNull(dati.documentiRichiesti);
    if (documenti) risultato.documentiRichiesti = documenti;

    if (typeof dati.altriRequisiti === "string" && dati.altriRequisiti.trim()) {
      risultato.altriRequisiti = dati.altriRequisiti.trim();
    }

    return risultato;
  } catch {
    return null;
  }
}

/**
 * Arricchisce una MisuraGrezza (già prodotta dal parser di fonte dalla
 * pagina elenco) visitando la sua pagina di dettaglio. Non lancia mai
 * eccezioni: in caso di qualunque problema restituisce `grezza` invariata.
 */
export async function arricchisciConDettaglio(grezza: MisuraGrezza): Promise<MisuraGrezza> {
  const testo = await scaricaTestoDettaglio(grezza.linkFonteUfficiale);
  if (!testo) return grezza;

  const arricchitaRegex = arricchisciConRegex(testo, grezza);
  const daAI = await estraiConAI(testo, grezza.titolo);
  if (!daAI) return arricchitaRegex;

  return { ...arricchitaRegex, ...daAI };
}
