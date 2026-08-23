/**
 * Parser dedicato — Invitalia (bandi/incentivi nazionali).
 *
 * SELETTORI_VOCE_CALIBRATI calibrati su HTML reale di entrambe le sezioni
 * del sito ("per le imprese" e "per chi vuole fare impresa"): il titolo
 * vero sta in `h3 a.card-unified__title` dentro `article.card-unified`, il
 * link "Leggi tutto" nella stessa card punta allo stesso URL ma non è il
 * titolo — vedi anche `estraiTitoloEffettivo` in shared.ts. Sulla seconda
 * sezione molte card hanno un titolo pulito (es. "Cultura Cresce") senza
 * nessuna parola chiave/data nel testo raccolto: essendo un selettore
 * verificato a mano, questi candidati sono valutati con la soglia
 * permissiva SOGLIA_VOCE_BANDO_CALIBRATA invece di quella generica — vedi
 * il commento su quella costante in shared.ts.
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

// Verificati a mano contro l'HTML reale di due card diverse (una per
// sezione: "per le imprese" e "per chi vuole fare impresa") — identificano
// da soli una card di incentivo, valutati con la soglia più permissiva
// (SOGLIA_VOCE_BANDO_CALIBRATA): un titolo pulito come "Cultura Cresce",
// senza parole chiave/data/etichetta di stato nel testo raccolto, non va
// scartato solo perché il testo da solo non basterebbe — qui è la
// struttura del sito, non il testo, a garantire che sia una card reale.
const SELETTORI_VOCE_CALIBRATI = ["h3 a.card-unified__title", ".card-unified__title", "article.card-unified a", "a[href*='/incentivi-e-strumenti/']"];

// Selettori generici di ripiego, mai verificati contro l'HTML reale — solo
// per il caso in cui il sito cambi struttura: soggetti alla soglia
// generica (parole chiave/data/stato richiesti nel testo).
const SELETTORI_VOCE_FALLBACK = [".card-incentivo a", ".listing-item a", "article a[href]", "main ul li a[href]"];

export const parserInvitalia: ParserFonte = async (html, contestoUrl) => {
  const $ = cheerio.load(html);
  const vociCandidate = estraiVociListaGenerico($, contestoUrl, SELETTORI_VOCE_FALLBACK, SELETTORI_VOCE_CALIBRATI);
  const voci = await filtraCandidatiConAI(vociCandidate);

  const misure = voci.map((voce) => {
    const scadenzaMatch = voce.testoCompleto.match(/(?:scadenza|chiude il|entro il)[^\d]{0,15}([\d]{1,2}[/\-.][\d]{1,2}[/\-.][\d]{4}|\d{1,2}\s+\w+\s+\d{4})/i);
    const dataScadenza = scadenzaMatch ? parseDataItaliana(scadenzaMatch[1]) : null;
    const importo = parseImportoEuro(voce.testoCompleto);
    const tassoZero = /tasso\s?(zero|agevolato)/i.test(voce.testoCompleto);

    return buildMisuraGrezzaBase({
      externalId: externalIdDaUrl(voce.linkDettaglio),
      titolo: voce.titolo,
      ente: "Invitalia",
      categoria: "NAZIONALE",
      descrizioneBreve: voce.titolo,
      linkFonteUfficiale: voce.linkDettaglio,
      dataScadenza: dataScadenza ?? undefined,
      tipoAgevolazione: tassoZero ? "TASSO_ZERO" : "MISTO",
      importoFisso: importo,
    });
  });

  return { misure, contenutoGrezzo: hashContenuto($.root().text()) };
};
