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

/**
 * Strategia generica "elenco di card/righe con un link": prova una lista di
 * selettori CSS candidati (dal più specifico al più generico) e restituisce
 * la prima lista con abbastanza voci plausibili (titolo non vuoto + link).
 * Ogni parser di fonte la usa come primo passo, poi applica le proprie
 * regole per interpretare scadenza/importo/requisiti dal testo della voce.
 */
export function estraiVociListaGenerico(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  selettoriCandidati: string[],
  minVociAttese = 1,
): EstrazioneVoceLista[] {
  for (const selettore of selettoriCandidati) {
    const nodi = $(selettore);
    const voci: EstrazioneVoceLista[] = [];

    nodi.each((_, el) => {
      const $el = $(el);
      const $link = $el.is("a") ? $el : $el.find("a[href]").first();
      const href = $link.attr("href");
      const url = risolviUrl(baseUrl, href);
      const titolo = testoPulito($link.length ? $link : $el);
      if (url && titolo && titolo.length > 4) {
        voci.push({ linkDettaglio: url, titolo, testoCompleto: testoPulito($el) });
      }
    });

    if (voci.length >= minVociAttese) return voci;
  }
  return [];
}

export function buildMisuraGrezzaBase(overrides: Partial<MisuraGrezza> & Pick<MisuraGrezza, "externalId" | "titolo" | "linkFonteUfficiale">): MisuraGrezza {
  const oraPiuUnAnno = new Date();
  oraPiuUnAnno.setFullYear(oraPiuUnAnno.getFullYear() + 1);

  const base: MisuraGrezza = {
    ente: "",
    categoria: "NAZIONALE",
    descrizioneBreve: overrides.titolo,
    tipoAgevolazione: "MISTO",
    tipoValore: "IMPORTO_FISSO",
    dataApertura: new Date(),
    dataScadenza: oraPiuUnAnno,
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
