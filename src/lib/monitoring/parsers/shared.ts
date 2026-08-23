import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { MisuraGrezza } from "../types";

const MESI: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

/** Riconosce date italiane sia numeriche (31/12/2026, 31-12-2026) sia testuali (31 dicembre 2026). */
export function parseDataItaliana(testo: string): Date | null {
  const t = testo.trim().toLowerCase();

  const numerica = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (numerica) {
    const [, gg, mm, aaaa] = numerica;
    const d = new Date(Number(aaaa), Number(mm) - 1, Number(gg));
    if (!Number.isNaN(d.getTime())) return d;
  }

  const testuale = t.match(/(\d{1,2})\s+([a-zàèéìòù]+)\s+(\d{4})/);
  if (testuale) {
    const [, gg, meseNome, aaaa] = testuale;
    const mese = MESI[meseNome];
    if (mese !== undefined) {
      const d = new Date(Number(aaaa), mese, Number(gg));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/** Estrae il primo importo in euro trovato nel testo (es. "€ 50.000", "50.000 euro"). */
export function parseImportoEuro(testo: string): number | null {
  const match = testo.match(/(?:€\s?|euro\s?)?([\d]{1,3}(?:[.\s]\d{3})*(?:,\d+)?)\s?(?:€|euro)?/i);
  if (!match) return null;
  const numero = match[1].replace(/[.\s]/g, "").replace(",", ".");
  const val = Number(numero);
  return Number.isFinite(val) && val > 0 ? val : null;
}

export function parsePercentuale(testo: string): number | null {
  const match = testo.match(/(\d{1,3}(?:,\d+)?)\s?%/);
  if (!match) return null;
  const val = Number(match[1].replace(",", "."));
  return Number.isFinite(val) ? val : null;
}

export function risolviUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** externalId stabile: hash dell'URL di dettaglio (o, in mancanza, del titolo). */
export function externalIdDaUrl(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 24);
}

export function hashContenuto(testo: string): string {
  return createHash("sha256").update(testo).digest("hex");
}

/**
 * Estrae il testo pulito da un nodo cheerio (spazi collassati, trim).
 */
export function testoPulito($el: cheerio.Cheerio<any>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

export { cheerio };

export type EstrazioneVoceLista = {
  linkDettaglio: string;
  titolo: string;
  testoCompleto: string;
};

// --- Scansione euristica: piano B (anzi, sempre attiva) quando i selettori
// CSS specifici di un sito non sono affidabili. Non richiede di conoscere la
// struttura HTML della pagina: assegna un punteggio ad ogni link della pagina
// in base a segnali testuali tipici di un bando/avviso, indipendentemente da
// classi o id. Serve a massimizzare le probabilità di trovare le misure
// anche su fonti mai calibrate a mano — a costo di qualche falso positivo
// in più, accettabile: una misura sbagliata si corregge in un attimo con
// "Segnala errore", una misura MAI vista invece sfugge del tutto al radar.
const PAROLE_CHIAVE_BANDO = [
  "bando",
  "bandi",
  "avviso",
  "avvisi",
  "voucher",
  "contributo",
  "contributi",
  "incentivo",
  "incentivi",
  "finanziamento",
  "finanziamenti",
  "agevolazione",
  "agevolazioni",
  "misura",
  "misure",
  "sovvenzione",
  "sovvenzioni",
  "credito d'imposta",
  "credito d imposta",
  "fondo perduto",
  "manifestazione di interesse",
  "call for",
  "domande",
  "sportello",
];

const PAROLE_ESCLUSE = [
  "privacy",
  "cookie",
  "note legali",
  "accessibilit",
  "mappa del sito",
  "sitemap",
  "amministrazione trasparente",
  "posta elettronica certificata",
  "credits",
  "newsletter",
  "cerca nel sito",
  "accedi",
  "login",
  "registrati",
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "canale rss",
  "rss feed",
  "vai al contenuto",
  "salta al contenuto",
  "torna su",
  "chi siamo",
  "contatti",
  "lavora con noi",
  "aste immobiliari",
  "aste giudiziarie",
  "avviso di vendita",
  "avviso d'asta",
  "bollo auto",
  "visite guidate",
  "orari di apertura",
  "meteo",
  "webcam",
];

const ESTENSIONI_FILE_DIRETTO = /\.(pdf|jpg|jpeg|png|zip|rar|doc|docx|xls|xlsx)(\?.*)?$/i;

/** Segnale positivo forte: il link punta a un percorso tipico di sezione bandi/avvisi. */
const PERCORSO_BANDO = /\/(bandi|bando|avvisi|avviso|contributi|incentivi|agevolazioni|finanziamenti)\//i;

export function punteggioVoceBando(titolo: string, href: string): number {
  const t = titolo.toLowerCase();
  let punti = 0;

  if (t.length < 8 || t.length > 220) punti -= 6;
  for (const parola of PAROLE_CHIAVE_BANDO) if (t.includes(parola)) punti += 3;
  for (const parola of PAROLE_ESCLUSE) if (t.includes(parola)) punti -= 12;
  if (PERCORSO_BANDO.test(href)) punti += 4; // l'URL stesso vive in una sezione bandi/avvisi
  if (/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}/.test(t)) punti += 2; // data esplicita nel testo del link
  if (/€|\beuro\b/.test(t)) punti += 1;
  if (ESTENSIONI_FILE_DIRETTO.test(href)) punti -= 8; // link diretto a un file, non a una pagina di dettaglio
  if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    punti -= 20;
  }

  return punti;
}

/**
 * Soglia minima per considerare un link una probabile misura: richiede
 * almeno un segnale forte (una parola chiave di dominio, o un percorso URL
 * tipico bandi/avvisi) — non basta un generico incrocio di punti deboli
 * (es. una data + una lunghezza plausibile) come bastava prima. Trovato
 * scansionando fonti reali: senza questa soglia più alta, pagine
 * istituzionali con tanti link a news/eventi/servizi (che nel complesso
 * possono comunque contenere una data o superare la lunghezza minima)
 * finivano scambiate per misure — con titoli chiaramente non pertinenti.
 */
export const SOGLIA_VOCE_BANDO = 3;

/**
 * Scansiona TUTTI i link della pagina e tiene solo quelli con punteggio
 * positivo — nessuna dipendenza da selettori CSS specifici del sito.
 */
function estraiVociListaEuristica($: cheerio.CheerioAPI, baseUrl: string, massimoRisultati = 80): EstrazioneVoceLista[] {
  const candidati: (EstrazioneVoceLista & { punti: number })[] = [];

  $("a[href]").each((_, el) => {
    const $link = $(el);
    const href = $link.attr("href") ?? "";
    const url = risolviUrl(baseUrl, href);
    if (!url) return;

    const titolo = testoPulito($link);
    if (!titolo) return;

    const punti = punteggioVoceBando(titolo, href);
    if (punti < SOGLIA_VOCE_BANDO) return;

    // Un po' di contesto in più dal contenitore del link (es. la card che lo racchiude).
    const $contenitore = $link.parent();
    const testoCompleto = testoPulito($contenitore.length ? $contenitore : $link);

    candidati.push({ linkDettaglio: url, titolo, testoCompleto, punti });
  });

  candidati.sort((a, b) => b.punti - a.punti);

  const viste = new Set<string>();
  const risultato: EstrazioneVoceLista[] = [];
  for (const c of candidati) {
    if (viste.has(c.linkDettaglio)) continue;
    viste.add(c.linkDettaglio);
    risultato.push({ linkDettaglio: c.linkDettaglio, titolo: c.titolo, testoCompleto: c.testoCompleto });
    if (risultato.length >= massimoRisultati) break;
  }
  return risultato;
}

/**
 * Strategia di estrazione a due livelli, pensata per dare priorità al
 * *non perdere misure* (recall) rispetto alla precisione chirurgica — ma
 * SEMPRE filtrata da `punteggioVoceBando`, sia che il candidato arrivi da
 * un selettore CSS sia dalla scansione euristica: un selettore ampio come
 * `main a[href]` (usato come ultima risorsa quando i selettori più
 * specifici non trovano nulla, cosa comune su fonti mai calibrate a mano)
 * senza questo filtro cattura QUALSIASI link della pagina — inclusi menu,
 * news istituzionali ed eventi, non solo bandi. Il filtro di rilevanza è
 * quindi un gate unico, indipendente da quale dei due percorsi ha trovato
 * il link:
 *
 *  1. Prova i selettori CSS candidati (dal più specifico al più generico) —
 *     quando azzeccati danno il segnale più pulito (titolo + contenitore
 *     corretti) — ma tiene solo i link che superano la soglia di rilevanza.
 *  2. Esegue SEMPRE anche la scansione euristica su tutti i link della
 *     pagina (vedi estraiVociListaEuristica), che non dipende dalla
 *     struttura HTML del sito e applica lo stesso filtro.
 *  3. Unisce i risultati deduplicando per URL — così una fonte mai
 *     calibrata a mano continua comunque a restituire qualcosa, invece di
 *     tornare a mani vuote, ma senza rumore da link non pertinenti.
 */
export function estraiVociListaGenerico(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  selettoriCandidati: string[],
  minVociAttese = 1,
): EstrazioneVoceLista[] {
  let vociDaSelettori: EstrazioneVoceLista[] = [];

  for (const selettore of selettoriCandidati) {
    const nodi = $(selettore);
    const voci: EstrazioneVoceLista[] = [];

    nodi.each((_, el) => {
      const $el = $(el);
      const $link = $el.is("a") ? $el : $el.find("a[href]").first();
      const href = $link.attr("href") ?? "";
      const url = risolviUrl(baseUrl, href);
      const titolo = testoPulito($link.length ? $link : $el);
      if (url && titolo && titolo.length > 4 && punteggioVoceBando(titolo, href) >= SOGLIA_VOCE_BANDO) {
        voci.push({ linkDettaglio: url, titolo, testoCompleto: testoPulito($el) });
      }
    });

    if (voci.length >= minVociAttese) {
      vociDaSelettori = voci;
      break;
    }
  }

  const vociEuristiche = estraiVociListaEuristica($, baseUrl);

  const viste = new Set(vociDaSelettori.map((v) => v.linkDettaglio));
  const unite = [...vociDaSelettori];
  for (const v of vociEuristiche) {
    if (!viste.has(v.linkDettaglio)) {
      viste.add(v.linkDettaglio);
      unite.push(v);
    }
  }

  return unite;
}

export function buildMisuraGrezzaBase(overrides: Partial<MisuraGrezza> & Pick<MisuraGrezza, "externalId" | "titolo" | "linkFonteUfficiale">): MisuraGrezza {
  const oraPiuUnAnno = new Date();
  oraPiuUnAnno.setFullYear(oraPiuUnAnno.getFullYear() + 1);

  // Il parser di fonte non ha trovato una scadenza leggibile nella pagina:
  // "oggi + 1 anno" è solo un segnaposto per non lasciare il campo (NOT
  // NULL a schema) vuoto — non è una data reale, quindi va marcata come
  // tale (scadenzaStimata) invece di essere mostrata in UI come se lo
  // fosse. Va calcolato PRIMA che il merge sotto applichi gli override.
  const scadenzaNonTrovata = overrides.dataScadenza == null;

  const base: MisuraGrezza = {
    ente: "",
    categoria: "NAZIONALE",
    descrizioneBreve: overrides.titolo,
    tipoAgevolazione: "MISTO",
    tipoValore: "IMPORTO_FISSO",
    dataApertura: new Date(),
    dataScadenza: oraPiuUnAnno,
    scadenzaStimata: scadenzaNonTrovata,
    atecoAmmessi: [],
    atecoEsclusi: [],
    regioniAmmesse: [],
    documentiRichiesti: [],
    externalId: overrides.externalId,
    titolo: overrides.titolo,
    linkFonteUfficiale: overrides.linkFonteUfficiale,
  };

  // Un override con valore esplicitamente `undefined` (es. una data non
  // riconosciuta dal parser) NON deve cancellare il default: si applicano
  // solo le chiavi realmente valorizzate dal parser di fonte.
  for (const [chiave, valore] of Object.entries(overrides)) {
    if (valore !== undefined) {
      (base as unknown as Record<string, unknown>)[chiave] = valore;
    }
  }

  return base;
}
