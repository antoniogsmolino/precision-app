import { creaParserCameraleGenerico } from "./factory";
import { CAMERE_DI_COMMERCIO } from "./config";
import type { ParserFonte } from "../../types";

/** Genera un parser dedicato per ciascuna Camera di Commercio in ./config.ts. */
export const PARSER_CAMERALI: Record<string, ParserFonte> = Object.fromEntries(
  CAMERE_DI_COMMERCIO.map((c) => [`cciaa-${c.slug}`, creaParserCameraleGenerico({ ente: c.ente, regione: c.regione })]),
);
