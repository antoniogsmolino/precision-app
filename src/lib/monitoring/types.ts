import type { CategoriaMisura, TipoAgevolazione, TipoValoreMisura } from "@prisma/client";

/**
 * Forma "grezza" di una misura così come estratta da un parser di fonte,
 * prima di essere trasformata in scrittura Prisma dal motore di
 * monitoraggio (src/lib/monitoring/engine.ts).
 *
 * `externalId` è l'unica cosa che DEVE essere stabile tra una scansione e
 * l'altra (di norma l'URL di dettaglio, o un suo hash): è la chiave con cui
 * il motore capisce se una misura è nuova o già vista.
 */
export interface MisuraGrezza {
  externalId: string;
  titolo: string;
  ente: string;
  categoria: CategoriaMisura;
  descrizioneBreve: string;
  descrizioneEstesa?: string;
  tipoAgevolazione: TipoAgevolazione;
  tipoValore: TipoValoreMisura;
  importoFisso?: number | null;
  importoMin?: number | null;
  importoMax?: number | null;
  percentuale?: number | null;
  tettoMassimo?: number | null;
  dataApertura: Date;
  dataScadenza: Date;
  /**
   * true quando `dataScadenza` NON è stata letta dalla pagina ma è un
   * fallback (vedi `buildMisuraGrezzaBase`) — mai impostarla a mano nei
   * singoli parser: viene calcolata automaticamente in base alla presenza
   * o meno di `dataScadenza` tra gli override passati.
   */
  scadenzaStimata?: boolean;
  atecoAmmessi?: string[];
  atecoEsclusi?: string[];
  regioniAmmesse?: string[];
  fatturatoMin?: number | null;
  fatturatoMax?: number | null;
  dipendentiMin?: number | null;
  dipendentiMax?: number | null;
  altriRequisiti?: string;
  documentiRichiesti?: string[];
  linkFonteUfficiale: string;
}

export interface RisultatoParser {
  misure: MisuraGrezza[];
  /** Contenuto usato per il diffing (hash) tra una scansione e l'altra. */
  contenutoGrezzo: string;
}

/**
 * Contratto che ogni parser di fonte deve rispettare. Un parser riceve
 * l'HTML già scaricato (fetch fatto centralmente dall'engine, che applica
 * robots.txt e User-Agent) e restituisce l'elenco di misure individuate.
 *
 * Aggiungere una fonte = scrivere un nuovo file in
 * src/lib/monitoring/parsers/ + registrarlo in registry.ts. Il resto del
 * motore (fetch, robots.txt, diffing, upsert, log) resta invariato.
 */
export type ParserFonte = (html: string, contestoUrl: string) => Promise<RisultatoParser> | RisultatoParser;
