/**
 * Header HTTP condivisi da ogni fetch del motore di monitoraggio (pagine
 * bando + robots.txt). Di default ci si presenta come un browser reale
 * (Chrome desktop, Accept-Language italiano) invece che con uno User-Agent
 * "da bot": non serve a nascondere nulla — il robots.txt resta comunque
 * sempre rispettato prima di ogni fetch (vedi `robots.ts`) — ma molti siti
 * della PA hanno un WAF che rifiuta a monte gli User-Agent generici/non
 * riconosciuti, restituendo un errore di rete indistinguibile da un sito
 * davvero irraggiungibile. Override possibile via `SCAN_USER_AGENT` se in
 * futuro serve identificarsi esplicitamente (es. accordo con un ente).
 */
export const USER_AGENT =
  process.env.SCAN_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const HEADERS_FETCH: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
};

/**
 * Estrae un messaggio d'errore diagnostico da un `fetch()` fallito. Node
 * (undici) avvolge quasi ogni errore di rete in un generico
 * `TypeError: fetch failed`, con la causa reale (DNS, TLS, connessione
 * rifiutata, timeout...) nascosta in `err.cause` — senza questo, ScanLog
 * mostra solo "fetch failed" per qualsiasi problema, inutile per capire se
 * è un dominio sbagliato, un timeout o un blocco del sito.
 */
export function messaggioErroreFetch(err: unknown): string {
  if (err instanceof Error) {
    const causa = (err as Error & { cause?: unknown }).cause;
    if (causa instanceof Error) {
      return `${err.message}: ${causa.message}`;
    }
    if (causa) {
      return `${err.message}: ${String(causa)}`;
    }
    return err.message;
  }
  return String(err);
}
