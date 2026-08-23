import { prisma } from "@/lib/prisma";
import { calcolaStatoMisura } from "@/lib/misure/stato";
import type { Misura, Prospect } from "@prisma/client";

/**
 * Motore di matching Prospect <-> Misura.
 *
 * Regole, zero AI: confronto diretto tra i campi anagrafici dell'azienda e i
 * requisiti di ammissibilità della misura (ATECO, regione, fatturato,
 * dipendenti). Usato sia dalla dashboard (Prospect) sia — a partire dalla
 * Fase 3 — dal frontend pubblico (dati del lead, stessa forma).
 *
 * Importante: il risultato è SEMPRE indicativo. Nessuna delle funzioni qui
 * sotto certifica un'ammissione: si limita a dire "in base ai dati
 * disponibili, questa azienda soddisfa i requisiti espliciti della misura".
 */

export interface DatiAziendaPerMatching {
  ateco?: string | null;
  regione?: string | null;
  fatturato?: number | null;
  numeroDipendenti?: number | null;
}

type RequisitiMisura = Pick<
  Misura,
  | "atecoAmmessi"
  | "atecoEsclusi"
  | "regioniAmmesse"
  | "fatturatoMin"
  | "fatturatoMax"
  | "dipendentiMin"
  | "dipendentiMax"
  | "dataApertura"
  | "dataScadenza"
>;

export interface EsitoMatch {
  isMatch: boolean;
  criteri: string[];
}

/** Adatta un Prospect (con Decimal Prisma) alla forma generica usata dal motore. */
function datiAziendaDaProspect(prospect: Prospect): DatiAziendaPerMatching {
  return {
    ateco: prospect.ateco,
    regione: prospect.regione,
    fatturato: prospect.fatturato != null ? Number(prospect.fatturato) : null,
    numeroDipendenti: prospect.numeroDipendenti,
  };
}

function normalizzaAteco(codice: string): string {
  return codice.replace(/[.\s]/g, "").toUpperCase();
}

/** true se `codice` rientra in uno dei prefissi ATECO indicati (es. "62" copre "62.01.00"). */
function atecoRientraInPrefissi(codice: string, prefissi: string[]): boolean {
  const codiceNorm = normalizzaAteco(codice);
  return prefissi.some((p) => codiceNorm.startsWith(normalizzaAteco(p)));
}

/**
 * Valuta se un'azienda soddisfa i requisiti di una misura.
 *
 * Politica sui dati mancanti: se la misura richiede un dato che l'azienda
 * non ha (es. fatturato non censito), il criterio NON viene considerato
 * fallito — viene segnalato come "da verificare" nell'elenco `criteri`,
 * senza escludere l'azienda dal match. Questo riflette la natura indicativa
 * del match: meglio segnalare un'opportunità da approfondire che scartarla
 * per un dato mancante nell'anagrafica importata.
 */
export function valutaMatch(azienda: DatiAziendaPerMatching, misura: RequisitiMisura): EsitoMatch {
  const criteri: string[] = [];
  let fallito = false;

  // La misura deve essere aperta (Attiva o In scadenza) al momento della valutazione.
  const stato = calcolaStatoMisura(misura.dataApertura, misura.dataScadenza);
  if (stato !== "ATTIVA" && stato !== "IN_SCADENZA") {
    return { isMatch: false, criteri: [`Misura non aperta (stato attuale: ${stato.toLowerCase()})`] };
  }

  // ATECO esclusi (priorità sugli ammessi)
  if (misura.atecoEsclusi.length > 0) {
    if (!azienda.ateco) {
      criteri.push("⚠ ATECO azienda non disponibile: verificare manualmente le esclusioni settoriali");
    } else if (atecoRientraInPrefissi(azienda.ateco, misura.atecoEsclusi)) {
      criteri.push(`✗ ATECO ${azienda.ateco} rientra tra i settori esclusi`);
      fallito = true;
    }
  }

  // ATECO ammessi ([] = nessuna restrizione settoriale)
  if (!fallito && misura.atecoAmmessi.length > 0) {
    if (!azienda.ateco) {
      criteri.push("⚠ ATECO azienda non disponibile: da verificare rispetto ai settori ammessi");
    } else if (atecoRientraInPrefissi(azienda.ateco, misura.atecoAmmessi)) {
      criteri.push(`✓ ATECO ${azienda.ateco} ammesso`);
    } else {
      criteri.push(`✗ ATECO ${azienda.ateco} non rientra tra i settori ammessi`);
      fallito = true;
    }
  }

  // Regione ([] = tutte le regioni)
  if (!fallito && misura.regioniAmmesse.length > 0) {
    if (!azienda.regione) {
      criteri.push("⚠ Regione azienda non disponibile: da verificare");
    } else {
      const regioneNorm = azienda.regione.trim().toLowerCase();
      const ammessa = misura.regioniAmmesse.some((r) => r.trim().toLowerCase() === regioneNorm);
      if (ammessa) {
        criteri.push(`✓ Regione ${azienda.regione} ammessa`);
      } else {
        criteri.push(`✗ Regione ${azienda.regione} non tra quelle ammesse`);
        fallito = true;
      }
    }
  }

  // Fatturato
  if (!fallito && (misura.fatturatoMin != null || misura.fatturatoMax != null)) {
    if (azienda.fatturato == null) {
      criteri.push("⚠ Fatturato azienda non disponibile: requisito da verificare");
    } else {
      const min = misura.fatturatoMin != null ? Number(misura.fatturatoMin) : -Infinity;
      const max = misura.fatturatoMax != null ? Number(misura.fatturatoMax) : Infinity;
      if (azienda.fatturato >= min && azienda.fatturato <= max) {
        criteri.push("✓ Fatturato entro i limiti richiesti");
      } else {
        criteri.push("✗ Fatturato fuori dai limiti richiesti");
        fallito = true;
      }
    }
  }

  // Dipendenti
  if (!fallito && (misura.dipendentiMin != null || misura.dipendentiMax != null)) {
    if (azienda.numeroDipendenti == null) {
      criteri.push("⚠ Numero dipendenti non disponibile: requisito da verificare");
    } else {
      const min = misura.dipendentiMin ?? -Infinity;
      const max = misura.dipendentiMax ?? Infinity;
      if (azienda.numeroDipendenti >= min && azienda.numeroDipendenti <= max) {
        criteri.push("✓ Numero dipendenti entro i limiti richiesti");
      } else {
        criteri.push("✗ Numero dipendenti fuori dai limiti richiesti");
        fallito = true;
      }
    }
  }

  if (criteri.length === 0) {
    criteri.push("✓ Nessun requisito strutturato oltre alla finestra temporale: verificare i requisiti in testo libero");
  }

  return { isMatch: !fallito, criteri };
}

/** Ricalcola tutti i match di un singolo prospect contro tutte le misure aperte. */
export async function ricalcolaMatchPerProspect(prospectId: string) {
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const misure = await prisma.misura.findMany();

  await prisma.$transaction(async (tx) => {
    await tx.prospectMisuraMatch.deleteMany({ where: { prospectId } });
    const daCreare = misure
      .map((misura) => ({ misura, esito: valutaMatch(datiAziendaDaProspect(prospect), misura) }))
      .filter(({ esito }) => esito.isMatch)
      .map(({ misura, esito }) => ({
        prospectId,
        misuraId: misura.id,
        criteriEsito: esito.criteri,
      }));
    if (daCreare.length > 0) {
      await tx.prospectMisuraMatch.createMany({ data: daCreare });
    }
  });
}

/** Ricalcola tutti i match di una singola misura contro tutti i prospect. */
export async function ricalcolaMatchPerMisura(misuraId: string) {
  const misura = await prisma.misura.findUniqueOrThrow({ where: { id: misuraId } });
  const prospects = await prisma.prospect.findMany();

  await prisma.$transaction(async (tx) => {
    await tx.prospectMisuraMatch.deleteMany({ where: { misuraId } });
    const daCreare = prospects
      .map((prospect) => ({ prospect, esito: valutaMatch(datiAziendaDaProspect(prospect), misura) }))
      .filter(({ esito }) => esito.isMatch)
      .map(({ prospect, esito }) => ({
        prospectId: prospect.id,
        misuraId,
        criteriEsito: esito.criteri,
      }));
    if (daCreare.length > 0) {
      await tx.prospectMisuraMatch.createMany({ data: daCreare });
    }
  });
}

/** Ricalcolo completo (usato dopo import massivi o migrazioni dati). */
export async function ricalcolaTuttiIMatch() {
  const [prospects, misure] = await Promise.all([
    prisma.prospect.findMany(),
    prisma.misura.findMany(),
  ]);

  const daCreare: { prospectId: string; misuraId: string; criteriEsito: string[] }[] = [];
  for (const prospect of prospects) {
    for (const misura of misure) {
      const esito = valutaMatch(datiAziendaDaProspect(prospect), misura);
      if (esito.isMatch) {
        daCreare.push({ prospectId: prospect.id, misuraId: misura.id, criteriEsito: esito.criteri });
      }
    }
  }

  await prisma.$transaction([
    prisma.prospectMisuraMatch.deleteMany({}),
    ...(daCreare.length > 0 ? [prisma.prospectMisuraMatch.createMany({ data: daCreare })] : []),
  ]);

  return { prospectValutati: prospects.length, misureValutate: misure.length, matchTrovati: daCreare.length };
}
