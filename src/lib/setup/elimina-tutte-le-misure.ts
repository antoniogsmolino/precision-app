import type { PrismaClient } from "@prisma/client";

/**
 * Azzeramento totale su richiesta esplicita dell'utente ("ricominciamo da
 * zero", confermato: TUTTE le misure, comprese quelle inserite a mano,
 * cancellazione immediata) — propedeutico alla ricostruzione del motore
 * bandi secondo la nuova specifica tecnica (registro nazionale
 * proprietario, non più scraper). A differenza di
 * `resetMisureAutomatiche` (che risparmia le misure manuali) questo
 * cancella davvero ogni riga della tabella Misura.
 *
 * Cascata automatica via FK Prisma su:
 * - ProspectMisuraMatch (onDelete: Cascade)
 * - RicercaProspectLog (onDelete: Cascade)
 * - relazione self many-to-many Cumulabilita (gestita da Prisma)
 * ApiUsageLog.misuraId e Lead.misuraId sono SetNull: restano, ma orfani
 * di misura (accettabile, sono log storici).
 *
 * Sempre in modalità "anteprima" per default: il chiamante deve passare
 * esplicitamente `esegui: true` per cancellare davvero — stesso pattern
 * degli altri endpoint di setup di questo progetto.
 */
export async function eliminaTutteLeMisure(prisma: PrismaClient, opts: { esegui?: boolean } = {}) {
  const misureTotali = await prisma.misura.count();
  const fontiTotali = await prisma.fonte.count();

  if (opts.esegui) {
    await prisma.misura.deleteMany({});
    await prisma.fonte.updateMany({
      data: { ultimaScansioneAt: null, ultimoEsitoScan: null, ultimoHashContenuto: null },
    });
  }

  return {
    eseguito: Boolean(opts.esegui),
    misureRimosse: misureTotali,
    fontiResettate: opts.esegui ? fontiTotali : 0,
  };
}
