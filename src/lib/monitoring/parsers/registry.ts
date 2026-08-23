import type { ParserFonte } from "../types";
import { parserIncentiviGovIt } from "./incentivi-gov-it";
import { parserInvitalia } from "./invitalia";
import { parserUnioncamerePid } from "./unioncamere-pid";
import { parserSimest } from "./simest";
import { parserCciaaSudEstSicilia } from "./cciaa-sud-est-sicilia";
import { PARSER_REGIONALI } from "./regionale/registro";
import { PARSER_CAMERALI } from "./camerale/registro";

/**
 * Registro centrale dei parser di fonte.
 *
 * Per una fonte davvero "a sé" (struttura HTML particolare, priorità di
 * business dichiarata nel brief): scrivi un file dedicato in
 * src/lib/monitoring/parsers/<nome-fonte>.ts esportando un ParserFonte
 * (vedi ../types.ts) e aggiungilo qui sotto con una chiave stabile.
 *
 * Per una fonte regionale o camerale "standard" (la stragrande
 * maggioranza, viste le decine di enti coinvolti): aggiungi una riga a
 * ./regionale/config.ts o ./camerale/config.ts — il parser viene generato
 * automaticamente dalla factory e registrato qui senza scrivere codice.
 *
 * In entrambi i casi, crea poi la riga Fonte a DB con `parserKey` uguale
 * alla chiave di registro (via seed, o dal form fonti in dashboard).
 */
export const REGISTRO_PARSER: Record<string, ParserFonte> = {
  "incentivi-gov-it": parserIncentiviGovIt,
  invitalia: parserInvitalia,
  "unioncamere-pid": parserUnioncamerePid,
  simest: parserSimest,
  "cciaa-sud-est-sicilia": parserCciaaSudEstSicilia,
  ...PARSER_REGIONALI,
  ...PARSER_CAMERALI,
};

export function risolviParser(parserKey: string): ParserFonte | null {
  return REGISTRO_PARSER[parserKey] ?? null;
}
