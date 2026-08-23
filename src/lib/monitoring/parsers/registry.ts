import type { ParserFonte } from "../types";
import { parserIncentiviGovIt } from "./incentivi-gov-it";
import { parserInvitalia } from "./invitalia";
import { parserUnioncamerePid } from "./unioncamere-pid";
import { parserSimest } from "./simest";
import { parserCciaaSudEstSicilia } from "./cciaa-sud-est-sicilia";

/**
 * Registro centrale dei parser di fonte. Per aggiungere una nuova fonte:
 *
 *   1. Scrivi src/lib/monitoring/parsers/<nome-fonte>.ts esportando un
 *      ParserFonte (vedi ../types.ts per il contratto).
 *   2. Aggiungi la entry qui sotto con una chiave stabile.
 *   3. Crea la riga Fonte a DB con `parserKey` uguale a quella chiave
 *      (via seed, o dal form fonti in dashboard).
 *
 * Nessun'altra parte del motore di monitoraggio va toccata.
 */
export const REGISTRO_PARSER: Record<string, ParserFonte> = {
  "incentivi-gov-it": parserIncentiviGovIt,
  invitalia: parserInvitalia,
  "unioncamere-pid": parserUnioncamerePid,
  simest: parserSimest,
  "cciaa-sud-est-sicilia": parserCciaaSudEstSicilia,
};

export function risolviParser(parserKey: string): ParserFonte | null {
  return REGISTRO_PARSER[parserKey] ?? null;
}
