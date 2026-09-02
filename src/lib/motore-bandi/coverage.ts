import { prisma } from "@/lib/prisma";
import type { Fonte, HealthStatus } from "@prisma/client";

/**
 * Coverage Monitor (specifica motore bandi, §38) — componente obbligatorio
 * secondo la specifica: non basta contare i bandi, bisogna sapere quali
 * fonti si stanno leggendo correttamente. Costruito sui dati che il motore
 * scrive già (Fonte.healthStatus/consecutiveFailures/ultimaScansioneAt) —
 * nessun nuovo dato esterno richiesto, funziona per entrambi i motori
 * (vecchio HTML scraping e nuovo adapter-based) dato che ora entrambi
 * scrivono la stessa classificazione di salute (vedi
 * src/lib/monitoring/engine.ts e src/lib/motore-bandi/ingest.ts).
 */

export type Severita = "P0" | "P1" | "P2" | "P3";

export interface Anomalia {
  severita: Severita;
  fonteId: string;
  nomeFonte: string;
  descrizione: string;
}

export interface RiepilogoSalute {
  totale: number;
  perStato: Record<HealthStatus, number>;
}

export interface CoperturaTerritorio {
  regione: string;
  fontiTotali: number;
  fontiSane: number;
  /** true solo se OGNI fonte del territorio è HEALTHY — coerente con la specifica: "una Regione non può risultare coverage=HEALTHY" se anche una sola fonte richiesta non lo è. */
  sana: boolean;
}

export interface RapportoCoverage {
  generatoAlle: string;
  salute: RiepilogoSalute;
  perTerritorio: CoperturaTerritorio[];
  anomalie: Anomalia[];
}

const SOGLIA_ORE_FONTE_MAI_SCANSIONATA = 48;
const SOGLIA_GIORNI_FONTE_STANTIA = 3; // fonte attiva con ultima scansione più vecchia di questa soglia, indipendentemente dall'esito

/**
 * Severità di un'anomalia (specifica, §41): il livello dipende
 * dall'importanza della fonte (Tier 0 nazionale >> singola CCIAA) più dal
 * tipo di problema. Deliberatamente semplice: la specifica descrive P0/P1
 * come giudizi che coinvolgono "tutte le fonti regionali" o "il feed
 * nazionale fermo" — qui si approssima con sourceTier + livello, criterio
 * verificabile senza dover indovinare soglie più sofisticate senza dati
 * reali su cui calibrarle.
 */
function severitaPerFonte(fonte: Pick<Fonte, "sourceTier" | "livello">): Severita {
  if (fonte.sourceTier === "TIER_0_CATALOGO_NAZIONALE") return "P0";
  if (fonte.livello === "L1_NAZIONALE") return "P1";
  if (fonte.livello === "L2_REGIONALE") return "P2";
  return "P3"; // L3_CAMERALE
}

export async function calcolaCoverage(): Promise<RapportoCoverage> {
  const fonti = await prisma.fonte.findMany({ where: { attiva: true } });

  const perStato: Record<HealthStatus, number> = {
    HEALTHY: 0,
    DEGRADED: 0,
    FAILING: 0,
    BLOCKED: 0,
    UNKNOWN: 0,
    DISABLED: 0,
  };
  for (const f of fonti) perStato[f.healthStatus] += 1;

  // Coverage per territorio (specifica, §38.1): solo le fonti con una
  // regione associata (L2/L3) — le fonti nazionali non appartengono a un
  // singolo territorio.
  const perRegioneMap = new Map<string, Fonte[]>();
  for (const f of fonti) {
    if (!f.regione) continue;
    const elenco = perRegioneMap.get(f.regione) ?? [];
    elenco.push(f);
    perRegioneMap.set(f.regione, elenco);
  }
  const perTerritorio: CoperturaTerritorio[] = Array.from(perRegioneMap.entries())
    .map(([regione, elencoFonti]) => {
      const fontiSane = elencoFonti.filter((f) => f.healthStatus === "HEALTHY").length;
      return { regione, fontiTotali: elencoFonti.length, fontiSane, sana: fontiSane === elencoFonti.length };
    })
    .sort((a, b) => a.regione.localeCompare(b.regione));

  const adesso = Date.now();
  const anomalie: Anomalia[] = [];

  for (const fonte of fonti) {
    if (fonte.healthStatus === "BLOCKED" || fonte.healthStatus === "FAILING") {
      anomalie.push({
        severita: severitaPerFonte(fonte),
        fonteId: fonte.id,
        nomeFonte: fonte.nome,
        descrizione:
          fonte.healthStatus === "BLOCKED"
            ? `Bloccata da ${fonte.consecutiveFailures} scansioni consecutive in errore (o robots.txt)`
            : `In errore (${fonte.consecutiveFailures} fallimenti consecutivi)`,
      });
      continue; // già segnalata: non serve anche l'anomalia "stantia" sotto
    }

    if (!fonte.ultimaScansioneAt) {
      // Concede un margine (SOGLIA_ORE_FONTE_MAI_SCANSIONATA) prima di
      // segnalarla: una fonte appena registrata non ha ancora avuto il
      // tempo di essere presa in carico dal cron, non è un'anomalia.
      const registrataDaOre = (adesso - fonte.createdAt.getTime()) / 3_600_000;
      if (registrataDaOre > SOGLIA_ORE_FONTE_MAI_SCANSIONATA) {
        anomalie.push({
          severita: severitaPerFonte(fonte),
          fonteId: fonte.id,
          nomeFonte: fonte.nome,
          descrizione: `Mai scansionata da quando è attiva (registrata ${Math.round(registrataDaOre)}h fa)`,
        });
      }
      continue;
    }

    const giorniDaUltimaScansione = (adesso - fonte.ultimaScansioneAt.getTime()) / 86_400_000;
    if (giorniDaUltimaScansione > SOGLIA_GIORNI_FONTE_STANTIA) {
      anomalie.push({
        severita: severitaPerFonte(fonte),
        fonteId: fonte.id,
        nomeFonte: fonte.nome,
        descrizione: `Ultima scansione ${Math.round(giorniDaUltimaScansione)} giorni fa — oltre la soglia attesa`,
      });
    }
  }

  const ordineSeverita: Record<Severita, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  anomalie.sort((a, b) => ordineSeverita[a.severita] - ordineSeverita[b.severita]);

  return {
    generatoAlle: new Date().toISOString(),
    salute: { totale: fonti.length, perStato },
    perTerritorio,
    anomalie,
  };
}
