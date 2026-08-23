/**
 * Parser dedicato — mimit.gov.it/it/incentivi (sito istituzionale del
 * Ministero delle Imprese e del Made in Italy, sezione incentivi diretta
 * — segnalato dal team, dominio diverso da incentivi.gov.it, il portale
 * aggregatore dedicato già coperto da incentivi-gov-it.ts). Possibile
 * sovrapposizione parziale di contenuti tra i due, accettabile: meglio
 * un eventuale doppione (il filtro AI + le regole tengono comunque solo
 * le voci pertinenti) che perdere una misura presente solo qui.
 *
 * NOTA DI CALIBRAZIONE (aggiornata su HTML reale inviato dal team): le
 * pagine di dettaglio vivono sotto `/it/incentivi/nome-misura` (plurale
 * "incentivi", non "incentivo" — il selettore precedente aveva un errore
 * di singolare/plurale e non intercettava MAI nessun link reale). Il
 * titolo sta in un `<h2><a>...</a></h2>`, ma la descrizione/data stanno in
 * un `<p>` FRATELLO dell'`<h2>`, non al suo interno — vedi
 * `trovaContenitoreVoce` in shared.ts, che ora risale i genitori invece di
 * fermarsi al genitore diretto del link, altrimenti il contesto letto era
 * identico al solo titolo e la card non aveva mai i segnali richiesti.
 */
import {
  buildMisuraGrezzaBase,
  estraiVociListaGenerico,
  externalIdDaUrl,
  hashContenuto,
  parseDataItaliana,
  parseImportoEuro,
  cheerio,
} from "./shared";
import { filtraCandidatiConAI } from "../classificatore";
import type { ParserFonte } from "../types";

// Verificato a mano contro l'HTML reale: le pagine di dettaglio vivono
// sotto `/it/incentivi/nome-misura` — soglia permissiva
// (SOGLIA_VOCE_BANDO_CALIBRATA), stessa ragione di invitalia.ts.
const SELETTORI_VOCE_CALIBRATI = ["a[href*='/it/incentivi/']"];

// Selettori generici di ripiego, mai verificati contro l'HTML reale.
const SELETTORI_VOCE_FALLBACK = ["a[href*='/bando']", ".card-incentivo a", "article.card a", ".elenco-incentivi li a", "main article a[href]"];

export const parserMimitIncentivi: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE_FALLBACK, SELETTORI_VOCE_CALIBRATI);
  const voci = await filtraCandidatiConAI(vociCandidate);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|entro il|termine)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "MIMIT — Ministero delle Imprese e del Made in Italy",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      importoFisso: importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
