/** Parser dedicato — Regione Lombardia. */
import { creaParserRegionaleGenerico } from "./factory";

export const parserRegioneLombardia = creaParserRegionaleGenerico({
  ente: "Regione Lombardia",
  regione: "Lombardia",
});
