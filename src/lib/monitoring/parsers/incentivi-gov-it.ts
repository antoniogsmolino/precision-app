/**
 * Parser dedicato — incentivi.gov.it (portale ufficiale MIMIT, aggregatore).
 *
 * NOTA DI CALIBRAZIONE: questo ambiente di sviluppo non ha accesso alla rete
 * pubblica (egress bloccato dalla policy di sandbox), quindi i selettori CSS
 * sotto sono un best-effort basato sui pattern più comuni per portali PA
 * (Bootstrap Italia / Design System). Al primo scan reale, se `misure`
 * risulta vuoto pur con `contenutoGrezzo` valorizzato, verificare i
 * selettori con gli strumenti dev del browser e aggiornare
 * `SELETTORI_VOCE` qui sotto — il resto del motore non richiede modifiche.
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
  "a[href*='/bando']",
  "a[href*='/incentivo']",
  ".card-incentivo a",
  "article.card a",
  ".elenco-incentivi li a",
  "main article a[href]",
];

export const parserIncentiviGovIt: ParserFonte = (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const voci = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il|termine)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "MIMIT — incentivi.gov.it",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      importoFisso: importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
