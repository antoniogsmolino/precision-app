/**
 * Parser dedicato — SIMEST (finanziamenti/agevolazioni per internazionalizzazione).
 * Stessa nota di calibrazione degli altri parser di Livello 1.
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
  "a[href*='finanziament']",
  "a[href*='agevolazion']",
  ".card a[href]",
  ".listing a[href]",
  "main a[href]",
];

export const parserSimest: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);
  const voci = await filtraCandidatiConAI(vociCandidate);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);
    const tassoZero = /tasso\s?(zero|agevolato)/i.test(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "SIMEST",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      tipoAgevolazione: tassoZero ? "TASSO_ZERO" : "MISTO",
      importoFisso: importo,
      altriRequisiti: "Misura orientata a progetti di internazionalizzazione: verificare requisiti specifici sulla fonte ufficiale.",
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
