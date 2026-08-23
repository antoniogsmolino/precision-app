/**
 * Factory per i parser di fonte camerale (Livello 3 — Camere di Commercio
 * provinciali/territoriali). Stesso schema della factory regionale: una
 * fonte camerale in più costa una riga di configurazione, non un nuovo
 * parser da scrivere a mano.
 */
import {
  buildMisuraGrezzaBase,
  estraiVociListaGenerico,
  externalIdDaUrl,
  hashContenuto,
  parseDataItaliana,
  parseImportoEuro,
  cheerio,
} from "../shared";
import type { ParserFonte } from "../../types";

const SELETTORI_VOCE_DEFAULT = [
  "a[href*='/bandi/']",
  "a[href*='/bando/']",
  ".elenco-bandi li a",
  ".card-bando a",
  "table tr td a[href]",
  "main a[href]",
];

export interface ConfigParserCamerale {
  ente: string;
  regione: string;
  selettoriVoce?: string[];
}

export function creaParserCameraleGenerico(config: ConfigParserCamerale): ParserFonte {
  const selettori = config.selettoriVoce ?? SELETTORI_VOCE_DEFAULT;

  return (html, contestoUrl) => {
    const $ = cheerio.load(html);
    const voci = estraiVociListaGenerico($, contestoUrl, selettori);

    const misure = voci.map((voce) => {
      const scadenzaMatch = voce.testoCompleto.match(
        /(?:scadenza|entro il|termine)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i,
      );
      const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
      const importo = parseImportoEuro(voce.testoCompleto);

      return buildMisuraGrezzaBase({
        externalId: externalIdDaUrl(voce.linkDettaglio),
        titolo: voce.titolo,
        ente: config.ente,
        categoria: "CAMERALE",
        descrizioneBreve: voce.titolo,
        linkFonteUfficiale: voce.linkDettaglio,
        dataScadenza: dataScadenza ?? undefined,
        tipoAgevolazione: "FONDO_PERDUTO",
        importoFisso: importo,
        regioniAmmesse: [config.regione],
      });
    });

    return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
  };
}
