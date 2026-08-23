import Anthropic from "@anthropic-ai/sdk";
import type { EstrazioneVoceLista } from "./parsers/shared";

/**
 * Secondo gate, dopo il filtro a regole (parole chiave/regex in
 * shared.ts): quel filtro non può distinguere per significato — "bando",
 * "avviso", "domande" compaiono anche in notizie, comitati, eventi che
 * non sono misure di finanza agevolata. Qui si chiede a Claude un
 * giudizio esplicito, per ogni voce già passata il filtro a regole,
 * prima di scriverla come Misura.
 *
 * Fallito/non configurato -> FAIL-OPEN: si tengono i candidati così come
 * il filtro a regole li ha lasciati, non si blocca mai uno scan per un
 * problema di rete o una chiave mancante. La priorità resta "non perdere
 * misure vere": un errore di questo passaggio non deve mai far sparire un
 * bando reale, solo eventualmente lasciare passare qualche rumore in più
 * (che il filtro a regole a monte ha comunque già ridotto parecchio).
 */
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Claude Haiku 4.5: il modello Claude più economico attualmente
// disponibile ($1/$5 per milione di token in/out, contro $5/$25 di Opus
// 5 — un compito di classificazione binaria come questo non richiede la
// capacità di un modello di punta). Niente `thinking`/`output_config.effort`:
// non sono supportati su Haiku 4.5 per una richiesta di questo tipo.
const MODELLO = "claude-haiku-4-5";

// Lotto ampio (fino al massimo di candidati che l'estrazione euristica
// restituisce per fonte) per ammortizzare il costo fisso delle istruzioni
// del prompt su più voci possibili in una sola chiamata.
const DIMENSIONE_LOTTO = 80;
const LUNGHEZZA_CONTESTO = 300;

function costruisciPrompt(candidati: EstrazioneVoceLista[]): string {
  const elenco = candidati
    .map(
      (c, i) =>
        `${i}. Titolo: "${c.titolo}"\n   Contesto dalla pagina: "${c.testoCompleto.slice(0, LUNGHEZZA_CONTESTO)}"`,
    )
    .join("\n\n");

  return `Per ciascuna voce elencata sotto (estratta automaticamente da un sito istituzionale italiano), stabilisci se descrive una misura REALE di finanza agevolata per le imprese italiane — un bando, avviso, voucher, contributo, incentivo o finanziamento agevolato aperto o annunciato, rivolto ad aziende.

NON sono misure: articoli di cronaca o di blog, link di navigazione o CTA generiche, titoli di pagine indice/categoria, notizie su comitati/selezione di personale/eventi/servizi non finanziari, borse di studio o assegni di ricerca per individui, esiti di selezioni già chiuse (graduatorie approvate) presentati come notizia.

Il costo di un errore non è simmetrico: una misura inclusa per errore si scarta in un attimo dal team, una misura VERA scartata per errore invece sparisce e basta. In caso di dubbio reale (il titolo è plausibile ma il contesto è troppo corto per esserne certi), rispondi true.

${elenco}

Rispondi SOLO con un array JSON di ${candidati.length} valori booleani, nello stesso ordine dell'elenco (true = misura reale da tenere, false = da scartare). Nessun testo prima o dopo l'array.`;
}

async function classificaLotto(candidati: EstrazioneVoceLista[]): Promise<boolean[] | null> {
  if (!client || candidati.length === 0) return null;

  try {
    const response = await client.messages.create({
      model: MODELLO,
      max_tokens: 4096,
      messages: [{ role: "user", content: costruisciPrompt(candidati) }],
    });

    const blocco = response.content.find((b) => b.type === "text");
    const testo = blocco && "text" in blocco ? blocco.text : "";
    const match = testo.match(/\[[\s\S]*\]/);
    if (!match) return null;

    const risultato = JSON.parse(match[0]);
    if (!Array.isArray(risultato) || risultato.length !== candidati.length) return null;

    return risultato.map((v) => Boolean(v));
  } catch {
    return null;
  }
}

/**
 * Filtra i candidati già passati dal gate a regole con un giudizio di
 * Claude. Fail-open ad ogni livello: chiave non configurata, errore di
 * rete, risposta non interpretabile -> quel lotto passa invariato invece
 * di essere scartato o di far fallire l'intera scansione.
 */
export async function filtraCandidatiConAI(candidati: EstrazioneVoceLista[]): Promise<EstrazioneVoceLista[]> {
  if (!client || candidati.length === 0) return candidati;

  const risultato: EstrazioneVoceLista[] = [];
  for (let i = 0; i < candidati.length; i += DIMENSIONE_LOTTO) {
    const lotto = candidati.slice(i, i + DIMENSIONE_LOTTO);
    const verdetti = await classificaLotto(lotto);
    if (!verdetti) {
      // Lotto non classificabile: fail-open, si tiene così com'è.
      risultato.push(...lotto);
      continue;
    }
    lotto.forEach((c, idx) => {
      if (verdetti[idx]) risultato.push(c);
    });
  }
  return risultato;
}
