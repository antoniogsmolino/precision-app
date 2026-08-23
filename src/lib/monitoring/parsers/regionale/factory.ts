/**
 * Factory per i parser di fonte regionale (Livello 2).
 *
 * Le pagine bandi delle Regioni italiane condividono lo stesso problema dei
 * portali nazionali di Fase 1 (struttura HTML variabile, spesso su portali
 * regionali con pattern simili tra loro — tipicamente elenchi di card o
 * righe di tabella con titolo, scadenza, eventuale importo). Invece di
 * duplicare la logica di estrazione per ognuna delle 20 Regioni, ogni fonte
 * regionale è un file minuscolo che configura questa factory con i propri
 * selettori/ente/regione — resta comunque "un parser per fonte" ai fini
 * della registrazione (src/lib/monitoring/parsers/registry.ts), ma il
 * costo marginale per aggiungere una regione in più è basso.
 *
 * NOTA DI CALIBRAZIONE (stessa di Fase 1): i selettori di default sono
 * best-effort, scritti senza accesso alla rete pubblica da questo ambiente.
 * Ogni fonte regionale può sovrascrivere `selettoriVoce` con selettori
 * specifici una volta verificato l'HTML reale.
 */
import {
  buildMisuraGrezzaBase,
  estraiVociListaGenerico,
  externalIdDaUrl,
  hashContenuto,
  parseDataItaliana,
  parseImportoEuro,
  cheerio,
} from "../shared";
import { filtraCandidatiConAI } from "../../classificatore";
import type { ParserFonte } from "../../types";

const SELETTORI_VOCE_DEFAULT = [
  "a[href*='/bandi/']",
  "a[href*='/bando/']",
  ".elenco-bandi li a",
  ".card-bando a",
  "table tr td a[href]",
  "main a[href]",
];

export interface ConfigParserRegionale {
  /** Nome ente mostrato sulle misure rilevate, es. "Regione Sicilia". */
  ente: string;
  /** Regione ammessa da assegnare automaticamente alle misure rilevate. */
  regione: string;
  /** Selettori CSS candidati per individuare le voci elenco (in ordine di priorità). */
  selettoriVoce?: string[];
}

export function creaParserRegionaleGenerico(config: ConfigParserRegionale): ParserFonte {
  const selettori = config.selettoriVoce ?? SELETTORI_VOCE_DEFAULT;

  return async (html, contestoUrl) => {
    const $ = cheerio.load(html);
    const vociCandidate = estraiVociListaGenerico($, contestoUrl, selettori);
    // Secondo gate: giudizio di Claude sui candidati già passati dal filtro
    // a regole (fail-open se non configurato o in errore — vedi classificatore.ts).
    const voci = await filtraCandidatiConAI(vociCandidate);

    const misure = voci.map((voce) => {
      const scadenzaMatch = voce.testoCompleto.match(
        /(?:scadenza|entro il|termine)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i,
      );
      const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
      const importo = parseImportoEuro(voce.testoCompleto);

      return buildMisuraGrezzaBase({
        externalId: externalIdDaUrl(voce.linkDettaglio),
        titolo: voce.titolo,
        ente: config.ente,
        categoria: "REGIONALE",
        descrizioneBreve: voce.titolo,
        linkFonteUfficiale: voce.linkDettaglio,
        dataScadenza: dataScadenza ?? undefined,
        importoFisso: importo,
        regioniAmmesse: [config.regione],
      });
    });

    return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
  };
}
