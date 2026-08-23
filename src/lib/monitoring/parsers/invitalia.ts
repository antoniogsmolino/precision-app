/**
 * Parser dedicato — Invitalia (bandi/incentivi nazionali).
 *
 * SELETTORI_VOCE calibrati su HTML reale (card inviata dal team da
 * /per-le-imprese/incentivi-e-strumenti): il titolo vero sta in
 * `h3 a.card-unified__title` dentro `article.card-unified`, il link
 * "Leggi tutto" nella stessa card punta allo stesso URL ma non è il
 * titolo — vedi anche `estraiTitoloEffettivo` in shared.ts, che ora
 * recupera comunque il titolo giusto da qualunque intestazione anche
 * senza questi selettori specifici (fallback euristico), ma un selettore
 * mirato resta più preciso e più veloce.
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
import { filtraCandidatiConAI } from "../classificatore";
import type { ParserFonte } from "../types";

const SELETTORI_VOCE = [
  "h3 a.card-unified__title",
  ".card-unified__title",
  "article.card-unified a",
  "a[href*='/incentivi-e-strumenti/']",
  ".card-incentivo a",
  ".listing-item a",
  "article a[href]",
  "main ul li a[href]",
];

export const parserInvitalia: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);
  const voci = await filtraCandidatiConAI(vociCandidate);

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
