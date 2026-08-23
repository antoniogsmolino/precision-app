/**
 * Parser dedicato — CCIAA Sud Est Sicilia (Catania, Ragusa, Siracusa).
 * Primo test di fonte camerale/provinciale (Livello 3): le altre Camere di
 * Commercio andranno aggiunte una alla volta (Fase 4), ciascuna con il
 * proprio parser, seguendo esattamente questo stesso pattern.
 *
 * Stessa nota di calibrazione degli altri parser: selettori best-effort da
 * verificare al primo scan reale.
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
  "a[href*='/bandi/']",
  "a[href*='bando']",
  ".elenco-bandi li a",
  "table tr td a[href]",
  "main a[href]",
];

export const parserCciaaSudEstSicilia: ParserFonte = (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const voci = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "CCIAA Sud Est Sicilia (Catania · Ragusa · Siracusa)",
      categoria: "CAMERALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      tipoAgevolazione: "FONDO_PERDUTO",
      importoFisso: importo,
      regioniAmmesse: ["Sicilia"],
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
