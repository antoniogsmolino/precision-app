/**
 * Client di basso livello per l'API "Company" di OpenAPI — endpoint
 * confermati dalle specifiche di funzionamento del team (§7):
 *
 *   Search:   GET https://company.openapi.com/IT-search
 *   Advanced: GET https://company.openapi.com/IT-advanced/{identificativo}
 *
 * Sostituisce il precedente endpoint indovinato (`IT-start`, usato nella
 * prima versione di src/lib/integrations/openapi-business.ts): quello era
 * un tentativo senza conferma, questo viene direttamente dal documento di
 * specifiche del team. Autenticazione ed endpoint sandbox verificati con
 * richieste reali il 03/09/2026:
 *  - header "Authorization: Bearer <token>" — senza "Bearer" la richiesta
 *    viene bloccata a monte con un 403 HTML generico, mai valutata dal
 *    server applicativo di OpenAPI;
 *  - il <token> giusto è il valore "token" della dashboard OpenAPI, NON
 *    la "API Key" (quella torna sempre {"message":"Wrong Token"});
 *  - l'ambiente sandbox vive su test.company.openapi.com, un dominio
 *    diverso da quello di produzione (company.openapi.com, il default
 *    qui sotto) — va impostato via OPENAPI_IT_BASE_URL (vedi
 *    .env.example). La risposta di IT-advanced verificata in sandbox ha
 *    confermato anche la forma dei campi usata da advanced-mapper.ts.
 */

const BASE_URL = process.env.OPENAPI_IT_BASE_URL ?? "https://company.openapi.com";
const TIMEOUT_MS = 20_000;

export interface EsitoChiamataOpenApi<T> {
  ok: boolean;
  status: number;
  dati: T | null;
  /** true se l'errore è quasi certamente transitorio (rete/5xx/timeout) — utile a chi chiama per decidere se ritentare. */
  transitorio: boolean;
}

async function chiamaOpenApi<T>(path: string, searchParams?: Record<string, string | number | boolean | undefined>): Promise<EsitoChiamataOpenApi<T>> {
  const apiKey = process.env.OPENAPI_IT_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, dati: null, transitorio: false };
  }

  const url = new URL(path, BASE_URL);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  try {
    const res = await fetch(url.toString(), {
      // Verificato con richieste reali (03/09/2026): "Authorization: <key>"
      // (senza "Bearer") viene bloccato con un 403 HTML generico prima
      // ancora di raggiungere il server applicativo di OpenAPI — non è un
      // rifiuto della chiave, è la forma dell'header che viene scartata a
      // monte. Con "Bearer" la richiesta arriva davvero a openapi.com
      // (risposta JSON strutturata), confermando che questo è il formato
      // corretto per l'header Authorization.
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "User-Agent": "MOLO4.0-RadarFinanzaAgevolata/1.0 (+https://molo4punto0.it)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // 401/403/402 (auth/credito) non sono transitori: ritentarli non
      // serve, vanno segnalati e il job va sospeso (vedi §15 specifiche).
      const transitorio = res.status >= 500 || res.status === 429;
      // Diagnostica (mai la chiave): la forma esatta dell'errore di OpenAPI
      // non è stata verificata contro l'API reale — questo log in
      // produzione (Vercel → Logs) è il modo più veloce per capire se è
      // un problema di autenticazione, di path o altro.
      const corpo = await res.text().catch(() => "");
      console.error(`[openapi-client] ${url.pathname} -> HTTP ${res.status}: ${corpo.slice(0, 500)}`);
      return { ok: false, status: res.status, dati: null, transitorio };
    }

    const json = (await res.json()) as T;
    return { ok: true, status: res.status, dati: json, transitorio: false };
  } catch (err) {
    // Errore di rete/timeout: transitorio, ritentabile con backoff da chi chiama.
    console.error(`[openapi-client] ${path} -> errore di rete/timeout:`, err instanceof Error ? err.message : err);
    return { ok: false, status: 0, dati: null, transitorio: true };
  }
}

export interface ParametriSearch {
  atecoCode?: string;
  province?: string;
  minTurnover?: number;
  maxTurnover?: number;
  minEmployees?: number;
  maxEmployees?: number;
  limit?: number;
  skip?: number;
  dryRun?: boolean;
}

/**
 * Forma della risposta di IT-search non confermata contro l'API reale —
 * si prova a leggere l'elenco di ID candidati da più percorsi plausibili
 * (vedi mappaRispostaSearch), senza assumerne uno come certo.
 */
export async function chiamaSearch(params: ParametriSearch) {
  return chiamaOpenApi<unknown>("/IT-search", {
    atecoCode: params.atecoCode,
    province: params.province,
    minTurnover: params.minTurnover,
    maxTurnover: params.maxTurnover,
    minEmployees: params.minEmployees,
    maxEmployees: params.maxEmployees,
    limit: params.limit,
    skip: params.skip,
    dryRun: params.dryRun,
  });
}

export function mappaRispostaSearch(raw: unknown): { candidati: string[]; totaleStimato: number | null } {
  const corpo = (raw as any)?.data ?? (raw as any)?.results ?? raw ?? {};
  const elenco: any[] = corpo.items ?? corpo.results ?? corpo.data ?? (Array.isArray(corpo) ? corpo : []);
  const candidati = elenco
    .map((v) => (typeof v === "string" ? v : (v?.id ?? v?.companyId ?? v?.vatCode ?? null)))
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const totaleRaw = (raw as any)?.count ?? (raw as any)?.total ?? corpo.count ?? corpo.total;
  const totaleStimato = totaleRaw != null && Number.isFinite(Number(totaleRaw)) ? Number(totaleRaw) : null;
  return { candidati, totaleStimato };
}

/** Advanced accetta P.IVA, codice fiscale o ID del provider come identificativo (§7). */
export async function chiamaAdvanced(identificativo: string) {
  return chiamaOpenApi<unknown>(`/IT-advanced/${encodeURIComponent(identificativo)}`);
}
