/**
 * Parser dedicato — Unioncamere / portale PID nazionale (Bando Voucher
 * Doppia Transizione e affini). Stessa nota di calibrazione degli altri
 * parser di Livello 1.
 */
import {
  buildMisuraGrezzaBase,
  estraiVociListaGenerico,
  externalIdDaUrl,
  hashContenuto,
  parseDataItaliana,
  parseImportoEuro,
  parsePercentuale,
  cheerio,
} from "./shared";
import { filtraCandidatiConAI } from "../classificatore";
import type { ParserFonte } from "../types";

const SELETTORI_VOCE = [
  "a[href*='voucher']",
  "a[href*='bando']",
  ".news-item a",
  ".card a[href]",
  "main a[href]",
];

export const parserUnioncamerePid: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);
  const voci = await filtraCandidatiConAI(vociCandidate);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const percentuale = parsePercentuale(voce.testoCompleto);
    const importo = parseImportoEuro(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "Unioncamere — Punto Impresa Digitale",
      categoria: "CAMERALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      tipoAgevolazione: "FONDO_PERDUTO",
      tipoValore: percentuale ? "PERCENTUALE" : "IMPORTO_FISSO",
      percentuale,
      tettoMassimo: percentuale ? importo : null,
      importoFisso: percentuale ? null : importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
