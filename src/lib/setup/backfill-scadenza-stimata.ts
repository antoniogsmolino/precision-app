import type { PrismaClient } from "@prisma/client";

const UN_GIORNO_MS = 24 * 60 * 60 * 1000;
const TOLLERANZA_MS = 3 * UN_GIORNO_MS;

/**
 * Correzione una tantum per le misure scritte PRIMA che il motore
 * distinguesse una scadenza vera da un segnaposto (`Misura.scadenzaStimata`,
 * introdotto dopo il primo giro di scan reale su produzione — vedi README).
 * Quelle misure hanno tutte `scadenzaStimata = false` di default anche
 * quando la data è in realtà il segnaposto "dataApertura + 1 anno" usato da
 * `buildMisuraGrezzaBase` quando il parser non trova una scadenza vera.
 *
 * Euristica: una misura rilevata automaticamente la cui `dataScadenza` cade
 * (con qualche giorno di tolleranza, per via di anni bisestili) esattamente
 * un anno dopo `dataApertura` è quasi certamente un segnaposto — un bando
 * reale con una finestra di esattamente 365 giorni è una coincidenza
 * plausibile ma rara, e comunque un falso positivo qui produce solo un
 * badge "da verificare" in più, mai la perdita di una misura.
 *
 * Idempotente: rilanciarla non fa danni, aggiorna solo le righe non ancora
 * corrette.
 */
export async function eseguiBackfillScadenzaStimata(prisma: PrismaClient) {
  const candidate = await prisma.misura.findMany({
    where: { rilevataAutomaticamente: true, scadenzaStimata: false },
    select: { id: true, dataApertura: true, dataScadenza: true },
  });

  const daCorreggere = candidate.filter((m) => {
    const unAnnoDopo = new Date(m.dataApertura);
    unAnnoDopo.setFullYear(unAnnoDopo.getFullYear() + 1);
    return Math.abs(m.dataScadenza.getTime() - unAnnoDopo.getTime()) <= TOLLERANZA_MS;
  });

  if (daCorreggere.length > 0) {
    await prisma.misura.updateMany({
      where: { id: { in: daCorreggere.map((m) => m.id) } },
      data: { scadenzaStimata: true },
    });
  }

  return {
    misureAutomaticheEsaminate: candidate.length,
    misureCorrette: daCorreggere.length,
  };
}
