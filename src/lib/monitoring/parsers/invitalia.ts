/**
 * Parser dedicato — Invitalia (bandi/incentivi nazionali).
 * Stessa nota di calibrazione di incentivi-gov-it.ts: selettori best-effort,
 * da rifinire al primo scan reale su SELETTORI_VOCE.
 */
import {
  buildMisuraGrezzaBase,
  estraiVociListaGenerico,
  externalIdDaUrl,
  hashContenuto,
  parseDataItaliana,
  parseImportoEuro,
  cheerio,
} from "./shared";
import type { ParserFonte } from "../types";

const SELETTORI_VOCE = [
  "a[href*='/cosa-facciamo/']",
  ".card-incentivo a",
  ".listing-item a",
  "article a[href]",
  "main ul li a[href]",
];

export const parserInvitalia: ParserFonte = (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const voci = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|chiude il|entro il)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);
    const tassoZero = /tasso\s?(zero|agevolato)/i.test(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "Invitalia",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      tipoAgevolazione: tassoZero ? "TASSO_ZERO" : "MISTO",
      importoFisso: importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
