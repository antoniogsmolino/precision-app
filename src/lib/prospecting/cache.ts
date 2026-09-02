import { prisma } from "@/lib/prisma";
import type { Prospect } from "@prisma/client";

/**
 * Cache persistente delle aziende (§8 delle specifiche) — riusa la tabella
 * Prospect esistente invece di introdurre un'entità `companies` parallela:
 * nel dominio di questo prodotto "azienda in cache" e "prospect" sono lo
 * stesso concetto, e tenerli separati avrebbe significato sincronizzare
 * due tabelle invece di una. `piva` resta la chiave naturale (già
 * @unique), `openApiId` la chiave di riconciliazione quando Search
 * restituisce solo un ID senza P.IVA nota (§7).
 */

const TTL_GIORNI = Number(process.env.OPENAPI_ADVANCED_TTL_GIORNI ?? "90");

export interface DatiAziendaRisolti {
  ragioneSociale: string;
  piva: string;
  openApiId: string | null;
  ateco: string | null;
  regione: string | null;
  provincia: string | null;
  fatturato: number | null;
  numeroDipendenti: number | null;
  /** null = mai risposto dal provider; undefined = non richiesta la PEC in questa risposta (mai il caso qui, sempre richiesta). */
  pec: string | null;
}

export function datiAncoraValidi(prospect: Pick<Prospect, "datiAcquisitiAt">): boolean {
  if (!prospect.datiAcquisitiAt) return false;
  const scadenza = new Date(prospect.datiAcquisitiAt);
  scadenza.setDate(scadenza.getDate() + TTL_GIORNI);
  return scadenza.getTime() > Date.now();
}

/** Cerca un'azienda già in cache per piva o per ID provider, con dati ancora entro la TTL. */
export async function trovaInCacheValida(chiave: { piva?: string; openApiId?: string }): Promise<Prospect | null> {
  if (!chiave.piva && !chiave.openApiId) return null;

  const prospect = await prisma.prospect.findFirst({
    where: {
      OR: [chiave.piva ? { piva: chiave.piva } : undefined, chiave.openApiId ? { openApiId: chiave.openApiId } : undefined].filter(
        (x): x is NonNullable<typeof x> => x !== undefined,
      ),
    },
  });

  if (!prospect || !datiAncoraValidi(prospect)) return null;
  return prospect;
}

/**
 * Upsert dell'anagrafica arricchita via Advanced. Riconciliazione per piva
 * quando disponibile (chiave primaria del dominio); altrimenti per
 * openApiId. Non fonde MAI automaticamente due record con piva diverse
 * anche se lo stesso openApiId li referenzia — quel caso (identificativi
 * in conflitto) è segnalato come limite dalle specifiche (§8): qui, più
 * semplicemente, l'unique constraint su openApiId fa fallire l'upsert e
 * l'errore risale al chiamante invece di far sparire un record.
 */
export async function salvaSnapshotAzienda(dati: DatiAziendaRisolti, fonteImport: string): Promise<Prospect> {
  const ora = new Date();
  const comune = {
    ragioneSociale: dati.ragioneSociale,
    ateco: dati.ateco,
    regione: dati.regione,
    provincia: dati.provincia,
    fatturato: dati.fatturato,
    numeroDipendenti: dati.numeroDipendenti,
    pec: dati.pec,
    openApiId: dati.openApiId,
    datiAcquisitiAt: ora,
  };

  return prisma.prospect.upsert({
    where: { piva: dati.piva },
    update: comune,
    create: { ...comune, piva: dati.piva, fonteImport },
  });
}
