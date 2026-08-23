/**
 * Parser dedicato — Regione Sicilia (territorio MOLO, priorità massima tra
 * le fonti regionali). Pagina bandi del portale regionale.
 */
import { creaParserRegionaleGenerico } from "./factory";

export const parserRegioneSicilia = creaParserRegionaleGenerico({
  ente: "Regione Siciliana",
  regione: "Sicilia",
});
