/**
 * Parser dedicato — CCIAA Sud Est Sicilia (Catania, Ragusa, Siracusa).
 * Primo test di fonte camerale/provinciale (Livello 3), territorio MOLO —
 * per questo ha un file a sé invece di stare nel batch di ./camerale/config.ts.
 */
import { creaParserCameraleGenerico } from "./camerale/factory";

export const parserCciaaSudEstSicilia = creaParserCameraleGenerico({
  ente: "CCIAA Sud Est Sicilia (Catania · Ragusa · Siracusa)",
  regione: "Sicilia",
});
