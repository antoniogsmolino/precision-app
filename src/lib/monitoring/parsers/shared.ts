import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { MisuraGrezza } from "../types";

const MESI: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

/** Riconosce date italiane sia numeriche (31/12/2026, 31-12-2026) sia testuali (31 dicembre 2026). */
export function parseDataItaliana(testo: string): Date | null {
  const t = testo.trim().toLowerCase();

  const numerica = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (numerica) {
    const [, gg, mm, aaaa] = numerica;
    const d = new Date(Number(aaaa), Number(mm) - 1, Number(gg));
    if (!Number.isNaN(d.getTime())) return d;
  }

  const testuale = t.match(/(\d{1,2})\s+([a-zàèéìòù]+)\s+(\d{4})/);
  if (testuale) {
    const [, gg, meseNome, aaaa] = testuale;
    const mese = MESI[meseNome];
    if (mese !== undefined) {
      const d = new Date(Number(aaaa), mese, Number(gg));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  return null;
}

const NUMERO_EURO = "[\\d]{1,3}(?:[.\\s]\\d{3})*(?:,\\d+)?";

/**
 * Estrae il primo importo in euro trovato nel testo (es. "€ 50.000",
 * "50.000 euro"). Il simbolo di valuta è SEMPRE richiesto (prima o dopo il
 * numero, mai assente): la versione precedente aveva entrambi i lati
 * opzionali, quindi QUALSIASI numero nel testo veniva letto come un
 * importo — es. "31 Dicembre 2026" restituiva "31 €", "4 settembre 2026"
 * restituiva "4 €". Trovato da titoli reali con importi assurdi in
 * produzione.
 */
export function parseImportoEuro(testo: string): number | null {
  const conPrefisso = testo.match(new RegExp(`€\\s?(${NUMERO_EURO})`, "i"));
  const conSuffisso = testo.match(new RegExp(`(${NUMERO_EURO})\\s?(?:€|euro)\\b`, "i"));
  const match = conPrefisso ?? conSuffisso;
  if (!match) return null;
  const numero = match[1].replace(/[.\s]/g, "").replace(",", ".");
  const val = Number(numero);
  return Number.isFinite(val) && val > 0 ? val : null;
}

export function parsePercentuale(testo: string): number | null {
  const match = testo.match(/(\d{1,3}(?:,\d+)?)\s?%/);
  if (!match) return null;
  const val = Number(match[1].replace(",", "."));
  return Number.isFinite(val) ? val : null;
}

export function risolviUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** externalId stabile: hash dell'URL di dettaglio (o, in mancanza, del titolo). */
export function externalIdDaUrl(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 24);
}

export function hashContenuto(testo: string): string {
  return createHash("sha256").update(testo).digest("hex");
}

/**
 * Estrae il testo pulito da un nodo cheerio (spazi collassati, trim).
 */
export function testoPulito($el: cheerio.Cheerio<any>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

export { cheerio };

export type EstrazioneVoceLista = {
  linkDettaglio: string;
  titolo: string;
  testoCompleto: string;
};

// --- Scansione euristica: piano B (anzi, sempre attiva) quando i selettori
// CSS specifici di un sito non sono affidabili. Non richiede di conoscere la
// struttura HTML della pagina: assegna un punteggio ad ogni link della pagina
// in base a segnali testuali tipici di un bando/avviso, indipendentemente da
// classi o id. Serve a massimizzare le probabilità di trovare le misure
// anche su fonti mai calibrate a mano — a costo di qualche falso positivo
// in più, accettabile: una misura sbagliata si corregge in un attimo con
// "Segnala errore", una misura MAI vista invece sfugge del tutto al radar.
const PAROLE_CHIAVE_BANDO = [
  "bando",
  "bandi",
  "avviso",
  "avvisi",
  "voucher",
  "contributo",
  "contributi",
  "incentivo",
  "incentivi",
  "finanziamento",
  "finanziamenti",
  "agevolazione",
  "agevolazioni",
  "misura",
  "misure",
  "sovvenzione",
  "sovvenzioni",
  "credito d'imposta",
  "credito d imposta",
  "fondo perduto",
  "manifestazione di interesse",
  "call for",
  "domande",
  "sportello",
];

const PAROLE_ESCLUSE = [
  "privacy",
  "cookie",
  "note legali",
  "accessibilit",
  "mappa del sito",
  "sitemap",
  "amministrazione trasparente",
  "posta elettronica certificata",
  "credits",
  "newsletter",
  "cerca nel sito",
  "accedi",
  "login",
  "registrati",
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "canale rss",
  "rss feed",
  "vai al contenuto",
  "salta al contenuto",
  "torna su",
  "chi siamo",
  "contatti",
  "lavora con noi",
  "aste immobiliari",
  "aste giudiziarie",
  "avviso di vendita",
  "avviso d'asta",
  "bollo auto",
  "visite guidate",
  "orari di apertura",
  "meteo",
  "webcam",
  // Contenuti istituzionali reali ma FUORI TEMA rispetto alla finanza
  // agevolata alle imprese (selezione di personale, comitati, ricerca
  // individuale...): usano lo stesso vocabolario di un bando ("avviso",
  // "domande", "graduatoria"...) ma non sono misure a sostegno di imprese.
  "comitato etico",
  "sperimentazione clinica",
  "comitato scientifico",
  "commissione giudicatrice",
  "concorso pubblico",
  "selezione del personale",
  "procedura selettiva",
  "mobilità del personale",
  "borsa di studio",
  "assegno di ricerca",
  "posizione aperta",
  "offerta di lavoro",
];

/**
 * Frasi di navigazione ("leggi tutto", "vedi tutti"...) o titoli di pagine
 * indice/categoria ("bandi e avvisi pubblici"...) — non il nome di UNA
 * misura specifica, ma un link a una lista o un invito generico a cliccare.
 * Confronto per uguaglianza esatta (dopo normalizzazione), non "contains":
 * un veto assoluto, non un punteggio negativo che il resto del testo
 * potrebbe compensare — trovate in produzione passare il filtro standard
 * proprio perché, prese da sole, contengono zero segnali negativi e a
 * volte pescano un bonus dall'URL della pagina che le ospita (es. un
 * "leggi l'articolo" dentro una sezione "/bandi/" del sito).
 */
const FRASI_GENERICHE_ESCLUSE = new Set([
  "vedi tutti",
  "vedi tutto",
  "leggi tutto",
  "leggi larticolo",
  "leggi di piu",
  "scopri di piu",
  "maggiori informazioni",
  "per saperne di piu",
  "continua a leggere",
  "clicca qui",
  "vai alla pagina",
  "vai al sito",
  "approfondisci",
  "tutte le novita",
  "tutte le notizie",
  "bandi e avvisi pubblici",
  "bandi e avvisi",
  "avvisi pubblici",
  "elenco bandi",
  "sezione bandi",
  "tutti i bandi",
  "bandi in corso",
  "bandi aperti",
  "bandi scaduti",
  "bandi",
  "avvisi",
]);

const ESTENSIONI_FILE_DIRETTO = /\.(pdf|jpg|jpeg|png|zip|rar|doc|docx|xls|xlsx)(\?.*)?$/i;

/**
 * Segnale positivo, ma solo corroborante (mai sufficiente da solo — vedi
 * sotto): il link punta a un percorso tipico di sezione bandi/avvisi.
 * Ammette anche un suffisso dopo la parola chiave nello stesso segmento di
 * URL (es. "incentivi-e-strumenti", non solo "incentivi" esatto): trovato
 * su invitalia.it, dove le pagine di dettaglio vivono sotto
 * `/incentivi-e-strumenti/nome-misura` — con il solo match esatto
 * `/incentivi/` questo segnale non scattava mai per nessun link Invitalia,
 * reale o no.
 */
const PERCORSO_BANDO = /\/(bandi|bando|avvisi|avviso|contributi|incentivi|agevolazioni|finanziamenti)[a-z-]*\//i;

/**
 * Normalizza un titolo per il confronto con FRASI_GENERICHE_ESCLUSE:
 * minuscolo, apostrofi/punteggiatura rimossi (non sostituiti da uno
 * spazio — "l'articolo" deve diventare "larticolo", non "l articolo",
 * altrimenti non coincide più con le frasi elencate), spazi ripetuti
 * collassati.
 */
function normalizzaTitolo(titolo: string): string {
  return titolo
    .toLowerCase()
    .replace(/['’]/g, "")
    // Rimuove gli accenti (NFD scompone "più" in "piu" + accento
    // combinante, poi il replace toglie il carattere combinante) — senza
    // questo "più"/"cosi"/"perché" non coincidevano MAI con le voci senza
    // accento elencate in FRASI_GENERICHE_ESCLUSE: bug reale, trovato
    // perché faceva fallire il riconoscimento di CTA molto comuni come
    // "Scopri di più".
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MESI_REGEX = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre";
/** Data numerica (28/09/2026) o testuale (28 settembre 2026). */
const DATA_REGEX = new RegExp(`\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{4}|\\d{1,2}\\s+(?:${MESI_REGEX})\\s+\\d{4}`, "i");

/**
 * Etichette di stato ed espressioni tipiche di una card di incentivo su
 * un sito istituzionale — "In apertura", "Data chiusura", "candidature
 * aperte"... Trovato analizzando una card REALE (Invitalia) con titolo
 * "Fondo di contrasto alla deindustrializzazione 2026": il titolo di un
 * incentivo è spesso un nome proprio della misura, senza nessuna delle
 * parole chiave generiche (non contiene "bando"/"avviso"/"incentivo"),
 * quindi da solo non avrebbe mai superato la soglia — ma il resto della
 * card (stato, date di apertura/chiusura) è un segnale fortissimo e
 * specifico che il titolo da solo non può dare.
 */
const ETICHETTE_STATO_INCENTIVO =
  /\b(in apertura|in scadenza|in corso|attivo|attiva|aperto|aperta|chiuso|chiusa|candidature aperte|data apertura|data chiusura|data scadenza)\b/i;

/**
 * `contesto` (facoltativo) è il testo del contenitore della card, non solo
 * del titolo/link — molti titoli reali sono nomi propri della misura senza
 * alcuna parola chiave (vedi ETICHETTE_STATO_INCENTIVO sopra): scorporare
 * i segnali forti (data, stato, parole chiave) sul solo titolo perdeva
 * misure vere con un titolo "pulito". La soglia di lunghezza resta sul
 * titolo da solo (un contesto lungo non deve mascherare un titolo troppo
 * corto o troppo lungo per essere plausibile).
 */
export function punteggioVoceBando(titolo: string, href: string, contesto = ""): number {
  const t = titolo.toLowerCase();
  const testoAllargato = `${t} ${contesto.toLowerCase()}`;

  if (FRASI_GENERICHE_ESCLUSE.has(normalizzaTitolo(titolo))) return -50;

  let punti = 0;

  if (t.length < 8 || t.length > 220) punti -= 6;
  for (const parola of PAROLE_CHIAVE_BANDO) if (testoAllargato.includes(parola)) punti += 3;
  for (const parola of PAROLE_ESCLUSE) if (testoAllargato.includes(parola)) punti -= 12;
  // Corroborante ma non sufficiente da solo: 2 punti restano sotto soglia
  // (SOGLIA_VOCE_BANDO = 3) finché non si somma a un'altra parola chiave, a
  // una data o a un importo — un link generico che vive per caso sotto un
  // URL "/bandi/qualcosa" (es. un "leggi l'articolo" dentro quella sezione)
  // non deve passare per il solo fatto di trovarsi in quella cartella.
  if (PERCORSO_BANDO.test(href)) punti += 2;
  if (DATA_REGEX.test(testoAllargato)) punti += 2;
  if (/€|\beuro\b/.test(testoAllargato)) punti += 1;
  if (ETICHETTE_STATO_INCENTIVO.test(testoAllargato)) punti += 3;
  if (ESTENSIONI_FILE_DIRETTO.test(href)) punti -= 8; // link diretto a un file, non a una pagina di dettaglio
  if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    punti -= 20;
  }

  return punti;
}

/**
 * Soglia minima per considerare un link una probabile misura: richiede
 * almeno un segnale forte (una parola chiave di dominio, o un percorso URL
 * tipico bandi/avvisi) — non basta un generico incrocio di punti deboli
 * (es. una data + una lunghezza plausibile) come bastava prima. Trovato
 * scansionando fonti reali: senza questa soglia più alta, pagine
 * istituzionali con tanti link a news/eventi/servizi (che nel complesso
 * possono comunque contenere una data o superare la lunghezza minima)
 * finivano scambiate per misure — con titoli chiaramente non pertinenti.
 */
export const SOGLIA_VOCE_BANDO = 3;

/**
 * Soglia più permissiva per i candidati trovati tramite un selettore CSS
 * "calibrato" — verificato a mano contro l'HTML reale del sito (vedi i
 * commenti nei singoli parser di fonte, es. invitalia.ts), che da solo
 * identifica già in modo specifico una card di misura (una classe come
 * `.card-unified__title` o un pattern di URL come `/incentivi-e-strumenti/`
 * calibrato sul vero sito). In questo caso "questo È una card di
 * incentivo" non va dedotto dal testo: lo garantisce già la struttura del
 * sito, verificata a mano. Restano validi il veto assoluto
 * (FRASI_GENERICHE_ESCLUSE), la penalità di lunghezza titolo implausibile
 * e la penalità delle parole escluse/estensioni file/link non-pagina: un
 * titolo troppo corto o una "Privacy Policy" intercettata per sbaglio da
 * un selettore troppo ampio vanno comunque scartati. Trovato analizzando
 * una card reale (Invitalia, "Cultura Cresce") il cui titolo pulito non
 * conteneva alcuna parola chiave/data/etichetta di stato nel testo visibile
 * raccolto: con la soglia generica sarebbe stata scartata nonostante il
 * selettore calibrato l'avesse già trovata correttamente. -3 lascia
 * passare un titolo valido senza altri segnali (punteggio 0) ma continua a
 * scartare un titolo di lunghezza implausibile (-6) o qualunque match su
 * una parola esclusa (-12) o un link non-pagina (-8/-20).
 */
export const SOGLIA_VOCE_BANDO_CALIBRATA = -3;

// Intestazioni vere (h1-h6, o classi esplicite "titolo"/"title"): segnale
// quasi inequivocabile, preferite SEMPRE al testo del link quando presenti
// nel contenitore — indipendentemente dal punteggio. strong/b sono un
// segnale più debole (spesso usati anche per enfasi su "Scadenza:", non
// solo sul titolo): usati solo come ripiego, mai al posto di un titolo del
// link che da solo (senza il bonus del contesto) sarebbe già credibile.
const SELETTORI_TITOLO_FORTE = "h1, h2, h3, h4, h5, h6, .titolo, .title";
const SELETTORI_TITOLO_DEBOLE = "strong, b";

/**
 * Il testo del link non è sempre il vero titolo della misura: molti siti
 * scrivono il titolo in un'intestazione dentro la card/riga di lista, e
 * lasciano al link solo una CTA generica ("Leggi l'articolo", "Scopri di
 * più") — trovato su fonti reali, dove il titolo corretto ("Bando Voucher
 * Doppia Transizione 2026 - Webinar di presentazione il 6 luglio 2026")
 * era scritto correttamente nel contenitore ma scartato perché il link
 * portava solo "Leggi l'articolo". Quando il testo del link è una di
 * queste CTA (o è troppo corto per essere un titolo) si cerca un'
 * intestazione più specifica nello stesso contenitore e, se c'è, si usa
 * quella al posto del testo del link — invece di scartare la voce o,
 * peggio, tenere la CTA come se fosse il titolo.
 */
function titoloPlausibile(t: string): boolean {
  return t.length >= 8 && t.length <= 220;
}

function estraiTitoloEffettivo(
  $contenitore: cheerio.Cheerio<any>,
  titoloLink: string,
  href: string,
  contesto: string,
): string {
  if (!$contenitore.length) return titoloLink;

  // Segnale forte (h1-h6, .titolo/.title): preferito SEMPRE al testo del
  // link se presente e plausibile, indipendentemente dal punteggio — da
  // quando il punteggio considera anche il contesto della card (vedi
  // punteggioVoceBando), anche una CTA sporca come "Leggi tuttosu..."
  // supera la soglia grazie al contesto, ma resta comunque un titolo
  // sbagliato da mostrare: qui la scelta di QUALE testo usare come titolo
  // è deliberatamente indipendente da quella soglia.
  const titoloForte = testoPulito($contenitore.find(SELETTORI_TITOLO_FORTE).first());
  if (titoloForte && titoloPlausibile(titoloForte)) return titoloForte;

  // Segnale debole (strong/b): usato solo come ripiego, e solo se il testo
  // del link DA SOLO (senza il bonus del contesto) non sarebbe comunque un
  // titolo credibile — strong/b sono usati anche per enfasi su "Scadenza:"
  // o simili, non vanno preferiti a un titolo del link già valido.
  const punteggioLinkDaSolo = punteggioVoceBando(titoloLink, href);
  if (punteggioLinkDaSolo >= SOGLIA_VOCE_BANDO) return titoloLink;

  const titoloDebole = testoPulito($contenitore.find(SELETTORI_TITOLO_DEBOLE).first());
  return titoloDebole && titoloPlausibile(titoloDebole) ? titoloDebole : titoloLink;
}

/**
 * Trova il contenitore vero di una card/riga di lista intorno a un link,
 * da cui leggere il contesto completo (testoCompleto: data/importo/stato/
 * descrizione) e recuperare il titolo vero quando il link è solo una CTA.
 *
 * Prova prima i tag/classi tipici di lista (li/article/tr/.card/.item/
 * .news-item/.box). Molti siti istituzionali però non usano NESSUno di
 * questi per il wrapper della card — solo <div> generici, col titolo in
 * un'intestazione (h2/h3) e la descrizione/data in un <p> FRATELLO
 * dell'intestazione, non discendente: fermarsi al genitore diretto del
 * link (che spesso è proprio quell'intestazione) prende solo il titolo e
 * perde tutto il resto. Trovato su mimit.gov.it: un link dentro un `<h2>`
 * con la descrizione+data nel `<p>` immediatamente successivo, fuori dal
 * `<h2>` — con `$link.parent()` il contesto letto era identico al solo
 * titolo, quindi la card non aveva mai i segnali (data/parola chiave) che
 * il punteggio richiede, pur essendo un incentivo reale.
 *
 * Fallback: risale i genitori (fino a un tetto di livelli, per non
 * arrivare a un contenitore enorme con più card mischiate insieme) e si
 * ferma al primo che aggiunge testo sostanziale rispetto al solo link —
 * cioè probabilmente include anche la descrizione/data che il genitore
 * diretto non conteneva.
 */
function trovaContenitoreVoce($link: cheerio.Cheerio<any>): cheerio.Cheerio<any> {
  const $diretto = $link.closest("li, article, tr, .card, .item, .news-item, .box");
  if ($diretto.length) return $diretto;

  const testoLink = testoPulito($link);
  const MASSIMO_LIVELLI = 4;
  const CRESCITA_MINIMA = 20;
  const TETTO_CARATTERI = 2000;

  let $corrente = $link.parent();
  for (let livello = 0; livello < MASSIMO_LIVELLI && $corrente.length; livello++) {
    const testoCorrente = testoPulito($corrente);
    if (testoCorrente.length >= testoLink.length + CRESCITA_MINIMA && testoCorrente.length <= TETTO_CARATTERI) {
      return $corrente;
    }
    $corrente = $corrente.parent();
  }

  return $link.parent();
}

/**
 * Scansiona TUTTI i link della pagina e tiene solo quelli con punteggio
 * positivo — nessuna dipendenza da selettori CSS specifici del sito.
 */
function estraiVociListaEuristica($: cheerio.CheerioAPI, baseUrl: string, massimoRisultati = 80): EstrazioneVoceLista[] {
  const candidati: (EstrazioneVoceLista & { punti: number })[] = [];

  $("a[href]").each((_, el) => {
    const $link = $(el);
    const href = $link.attr("href") ?? "";
    const url = risolviUrl(baseUrl, href);
    if (!url) return;

    const titoloLink = testoPulito($link);
    if (!titoloLink) return;

    // Contenitore più ampio del link (card/riga di lista): serve sia per il
    // contesto (testoCompleto, da cui si leggono data/importo/stato, e da
    // cui ora dipende anche il punteggio — vedi punteggioVoceBando) sia per
    // recuperare il vero titolo quando il link è solo una CTA generica.
    const $contenitoreEffettivo = trovaContenitoreVoce($link);
    const testoCompleto = testoPulito($contenitoreEffettivo.length ? $contenitoreEffettivo : $link);
    const titolo = estraiTitoloEffettivo($contenitoreEffettivo, titoloLink, href, testoCompleto);

    const punti = punteggioVoceBando(titolo, href, testoCompleto);
    if (punti < SOGLIA_VOCE_BANDO) return;

    candidati.push({ linkDettaglio: url, titolo, testoCompleto, punti });
  });

  candidati.sort((a, b) => b.punti - a.punti);

  const viste = new Set<string>();
  const risultato: EstrazioneVoceLista[] = [];
  for (const c of candidati) {
    if (viste.has(c.linkDettaglio)) continue;
    viste.add(c.linkDettaglio);
    risultato.push({ linkDettaglio: c.linkDettaglio, titolo: c.titolo, testoCompleto: c.testoCompleto });
    if (risultato.length >= massimoRisultati) break;
  }
  return risultato;
}

/**
 * Strategia di estrazione a due livelli, pensata per dare priorità al
 * *non perdere misure* (recall) rispetto alla precisione chirurgica — ma
 * SEMPRE filtrata da `punteggioVoceBando`, sia che il candidato arrivi da
 * un selettore CSS sia dalla scansione euristica: un selettore ampio come
 * `main a[href]` (usato come ultima risorsa quando i selettori più
 * specifici non trovano nulla, cosa comune su fonti mai calibrate a mano)
 * senza questo filtro cattura QUALSIASI link della pagina — inclusi menu,
 * news istituzionali ed eventi, non solo bandi. Il filtro di rilevanza è
 * quindi un gate unico, indipendente da quale dei due percorsi ha trovato
 * il link:
 *
 *  1. Prova TUTTI i selettori CSS candidati — non si ferma al primo che
 *     trova almeno un risultato: un selettore poco specifico messo prima
 *     nell'elenco che intercetta per caso un solo link irrilevante (es.
 *     un breadcrumb) fermava la ricerca lì, ignorando selettori più
 *     avanti nell'elenco che avrebbero trovato la vera lista di decine di
 *     voci — bug reale, trovato su fonti che rilevavano una sola misura
 *     nonostante la pagina reale ne contenesse molte di più. Ogni
 *     selettore che trova risultati contribuisce, tiene solo i link che
 *     superano la soglia di rilevanza.
 *  2. Esegue SEMPRE anche la scansione euristica su tutti i link della
 *     pagina (vedi estraiVociListaEuristica), che non dipende dalla
 *     struttura HTML del sito e applica lo stesso filtro.
 *  3. Unisce tutti i risultati deduplicando per URL — così una fonte mai
 *     calibrata a mano continua comunque a restituire qualcosa, invece di
 *     tornare a mani vuote, ma senza rumore da link non pertinenti.
 *
 * `selettoriCalibrati` (facoltativo): selettori verificati a mano contro
 * l'HTML reale del sito (vedi commenti nei singoli parser), che da soli
 * identificano già in modo specifico una card di misura — valutati con la
 * soglia più permissiva SOGLIA_VOCE_BANDO_CALIBRATA invece di
 * SOGLIA_VOCE_BANDO (vedi il commento lì per il perché: un titolo reale
 * ma "pulito", senza parole chiave/data nel testo raccolto, non deve
 * essere scartato quando è già la struttura del sito — non il testo — a
 * garantire che sia una card di incentivo).
 */
function estraiCandidatiDaSelettori(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  selettori: string[],
  soglia: number,
): EstrazioneVoceLista[] {
  const trovati: EstrazioneVoceLista[] = [];
  const viste = new Set<string>();

  for (const selettore of selettori) {
    const nodi = $(selettore);

    nodi.each((_, el) => {
      const $el = $(el);
      const $link = $el.is("a") ? $el : $el.find("a[href]").first();
      const href = $link.attr("href") ?? "";
      const url = risolviUrl(baseUrl, href);
      const titoloLink = testoPulito($link.length ? $link : $el);
      // Se il selettore punta direttamente al link (es. "a[href*='/bandi/']"),
      // $el COINCIDE col link: cercare un'intestazione dentro $el cercherebbe
      // dentro l'anchor stesso, che non ha figli di testo — serve risalire al
      // contenitore vero (card/riga di lista), stessa logica del percorso
      // euristico (vedi trovaContenitoreVoce).
      const $contenitoreTitolo = $el.is("a") ? trovaContenitoreVoce($el) : $el;
      // Il contesto (e testoCompleto salvato) viene dal contenitore vero,
      // non da $el: quando il selettore punta direttamente al link $el
      // coincide con l'anchor, il cui solo testo è spesso una CTA generica
      // ("Leggi tutto") — il contesto ricco (stato, date) sta nella card.
      const testoCompleto = testoPulito($contenitoreTitolo.length ? $contenitoreTitolo : $el);
      const titolo = estraiTitoloEffettivo($contenitoreTitolo, titoloLink, href, testoCompleto);
      if (
        url &&
        titolo &&
        titolo.length > 4 &&
        !viste.has(url) &&
        punteggioVoceBando(titolo, href, testoCompleto) >= soglia
      ) {
        viste.add(url);
        trovati.push({ linkDettaglio: url, titolo, testoCompleto });
      }
    });
  }

  return trovati;
}

export function estraiVociListaGenerico(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  selettoriCandidati: string[],
  selettoriCalibrati: string[] = [],
): EstrazioneVoceLista[] {
  const vociCalibrate = estraiCandidatiDaSelettori($, baseUrl, selettoriCalibrati, SOGLIA_VOCE_BANDO_CALIBRATA);
  const vociDaSelettori = estraiCandidatiDaSelettori($, baseUrl, selettoriCandidati, SOGLIA_VOCE_BANDO);
  const vociEuristiche = estraiVociListaEuristica($, baseUrl);

  const viste = new Set<string>();
  const unite: EstrazioneVoceLista[] = [];
  for (const gruppo of [vociCalibrate, vociDaSelettori, vociEuristiche]) {
    for (const v of gruppo) {
      if (!viste.has(v.linkDettaglio)) {
        viste.add(v.linkDettaglio);
        unite.push(v);
      }
    }
  }

  return unite;
}

export function buildMisuraGrezzaBase(overrides: Partial<MisuraGrezza> & Pick<MisuraGrezza, "externalId" | "titolo" | "linkFonteUfficiale">): MisuraGrezza {
  const oraPiuUnAnno = new Date();
  oraPiuUnAnno.setFullYear(oraPiuUnAnno.getFullYear() + 1);

  // Il parser di fonte non ha trovato una scadenza leggibile nella pagina:
  // "oggi + 1 anno" è solo un segnaposto per non lasciare il campo (NOT
  // NULL a schema) vuoto — non è una data reale, quindi va marcata come
  // tale (scadenzaStimata) invece di essere mostrata in UI come se lo
  // fosse. Va calcolato PRIMA che il merge sotto applichi gli override.
  const scadenzaNonTrovata = overrides.dataScadenza == null;

  const base: MisuraGrezza = {
    ente: "",
    categoria: "NAZIONALE",
    descrizioneBreve: overrides.titolo,
    tipoAgevolazione: "MISTO",
    tipoValore: "IMPORTO_FISSO",
    dataApertura: new Date(),
    dataScadenza: oraPiuUnAnno,
    scadenzaStimata: scadenzaNonTrovata,
    atecoAmmessi: [],
    atecoEsclusi: [],
    regioniAmmesse: [],
    documentiRichiesti: [],
    externalId: overrides.externalId,
    titolo: overrides.titolo,
    linkFonteUfficiale: overrides.linkFonteUfficiale,
  };

  // Un override con valore esplicitamente `undefined` (es. una data non
  // riconosciuta dal parser) NON deve cancellare il default: si applicano
  // solo le chiavi realmente valorizzate dal parser di fonte.
  for (const [chiave, valore] of Object.entries(overrides)) {
    if (valore !== undefined) {
      (base as unknown as Record<string, unknown>)[chiave] = valore;
    }
  }

  return base;
}
