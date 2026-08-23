import robotsParser from "robots-parser";
import { USER_AGENT, HEADERS_FETCH } from "./http";

/**
 * Verifica il robots.txt della fonte prima di ogni scansione. Se il
 * download del robots.txt fallisce, per prudenza si assume "consentito" ma
 * il fetch della pagina resta comunque protetto dal ritmo minimo definito
 * su ciascuna Fonte (frequenzaOreScan) — mai un controllo più aggressivo di
 * una volta al giorno di default.
 */
export async function verificaRobotsTxt(url: string): Promise<{ consentito: boolean; motivo?: string }> {
  try {
    const origin = new URL(url).origin;
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetch(robotsUrl, {
      headers: HEADERS_FETCH,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Nessun robots.txt pubblicato o non raggiungibile: procedi, ma senza
      // insistere (l'engine applica comunque il rate limit per fonte).
      return { consentito: true };
    }

    const testo = await res.text();
    const robots = robotsParser(robotsUrl, testo);
    const consentito = robots.isAllowed(url, USER_AGENT) ?? true;
    return consentito ? { consentito: true } : { consentito: false, motivo: "Disallow da robots.txt" };
  } catch (err) {
    return { consentito: true, motivo: `robots.txt non verificabile: ${(err as Error).message}` };
  }
}
