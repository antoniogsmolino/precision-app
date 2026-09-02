import { adapterIncentiviGovOpenData } from "./incentivi-gov-open-data";
import type { SourceAdapter } from "./tipi";

/**
 * Registro adapter del motore bandi — mirror di
 * src/lib/monitoring/parsers/registry.ts per il vecchio motore. Aggiungere
 * una fonte al nuovo motore = scrivere un nuovo adapter qui + registrarlo,
 * poi impostare Fonte.adapterKey sulla riga della fonte.
 */
const REGISTRO: Record<string, SourceAdapter> = {
  [adapterIncentiviGovOpenData.chiave]: adapterIncentiviGovOpenData,
};

export function risolviAdapter(adapterKey: string | null | undefined): SourceAdapter | null {
  if (!adapterKey) return null;
  return REGISTRO[adapterKey] ?? null;
}
