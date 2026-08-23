import { creaParserRegionaleGenerico } from "./factory";
import { REGIONI } from "./config";
import type { ParserFonte } from "../../types";

/**
 * Genera un parser dedicato per ciascuna delle 20 Regioni a partire da
 * ./config.ts — un file di configurazione invece di 20 file quasi
 * identici. Ogni voce riceve comunque la propria chiave di registro
 * stabile (`regione-<slug>`), quindi resta "un parser per fonte" a tutti
 * gli effetti (src/lib/monitoring/parsers/registry.ts la registra come
 * fonte a sé). Aggiungere una regione = aggiungere una riga a config.ts.
 */
export const PARSER_REGIONALI: Record<string, ParserFonte> = Object.fromEntries(
  REGIONI.map((r) => [`regione-${r.slug}`, creaParserRegionaleGenerico({ ente: r.ente, regione: r.regione })]),
);
