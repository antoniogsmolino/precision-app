import type { PrismaClient } from "@prisma/client";

/**
 * Azzeramento su richiesta esplicita dell'utente: rimuove TUTTE le misure
 * rilevate automaticamente (mai quelle inserite a mano dal team) e
 * resetta lo stato di scansione di ogni fonte, così un successivo
 * "Scansiona tutte ora" riparte da zero su tutte le 46 fonti con il
 * motore aggiornato (filtro a regole più severo + secondo filtro AI),
 * invece di essere bloccato dal rate limit di 24h per fonte già
 * scansionata di recente.
 *
 * Sempre in modalità "anteprima" per default (nessuna scrittura), stesso
 * pattern degli altri endpoint di setup: il chiamante deve passare
 * esplicitamente `esegui: true` per cancellare davvero.
 */
export async function resetMisureAutomatiche(prisma: PrismaClient, opts: { esegui?: boolean } = {}) {
  const misureAutomatiche = await prisma.misura.count({ where: { rilevataAutomaticamente: true } });
  const fontiTotali = await prisma.fonte.count();

  if (opts.esegui) {
    await prisma.misura.deleteMany({ where: { rilevataAutomaticamente: true } });
    await prisma.fonte.updateMany({
      data: { ultimaScansioneAt: null, ultimoEsitoScan: null, ultimoHashContenuto: null },
    });
  }

  return {
    eseguito: Boolean(opts.esegui),
    misureAutomaticheRimosse: misureAutomatiche,
    fontiResettate: opts.esegui ? fontiTotali : 0,
  };
}
