/**
 * Parser dedicato — mimit.gov.it/it/incentivi (sito istituzionale del
 * Ministero delle Imprese e del Made in Italy, sezione incentivi diretta
 * — segnalato dal team, dominio diverso da incentivi.gov.it, il portale
 * aggregatore dedicato già coperto da incentivi-gov-it.ts). Possibile
 * sovrapposizione parziale di contenuti tra i due, accettabile: meglio
 * un eventuale doppione (il filtro AI + le regole tengono comunque solo
 * le voci pertinenti) che perdere una misura presente solo qui.
 *
 * NOTA DI CALIBRAZIONE: stessa di incentivi-gov-it.ts — selettori
 * best-effort, da rifinire al primo scan reale.
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
  "a[href*='/bando']",
  "a[href*='/incentivo']",
  ".card-incentivo a",
  "article.card a",
  ".elenco-incentivi li a",
  "main article a[href]",
];

export const parserMimitIncentivi: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);
  const voci = await filtraCandidatiConAI(vociCandidate);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il|termine)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "MIMIT — Ministero delle Imprese e del Made in Italy",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      importoFisso: importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
