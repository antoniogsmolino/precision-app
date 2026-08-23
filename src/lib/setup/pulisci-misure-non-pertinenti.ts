import type { PrismaClient } from "@prisma/client";
import { punteggioVoceBando, SOGLIA_VOCE_BANDO } from "@/lib/monitoring/parsers/shared";

/**
 * Pulizia una tantum delle misure rilevate automaticamente PRIMA che il
 * filtro di rilevanza si applicasse anche ai risultati da selettore CSS
 * (vedi commit "Fix precisione estrazione...", shared.ts): quel bug
 * lasciava passare link generici (news, eventi, servizi comunali) come se
 * fossero bandi. Le righe già scritte in produzione con quel bug attivo non
 * spariscono da sole quando il codice viene corretto.
 *
 * Ri-applica lo stesso punteggio di rilevanza usato oggi in fase di scan a
 * ogni misura già rilevata automaticamente (titolo + link ufficiale, lo
 * stesso segnale usato dal parser) e considera "da rimuovere" solo quelle
 * che:
 *  1. sono sotto soglia con le regole ATTUALI (più severe di quelle con cui
 *     sono state inserite), e
 *  2. non hanno nessun prospect in match — mai cancellare una misura su cui
 *     il team ha già potenzialmente lavorato, quella si corregge a mano da
 *     "Segnala errore / Modifica".
 *
 * Sempre in modalità "anteprima" per default (nessuna scrittura): il
 * chiamante deve passare esplicitamente `esegui: true` per cancellare
 * davvero. Così una prima chiamata mostra sempre cosa verrebbe tolto prima
 * di doverlo confermare.
 */
export async function pulisciMisureNonPertinenti(prisma: PrismaClient, opts: { esegui?: boolean } = {}) {
  const candidate = await prisma.misura.findMany({
    where: { rilevataAutomaticamente: true },
    include: { _count: { select: { matches: true } } },
  });

  const daRimuovere = candidate.filter((m) => {
    if (m._count.matches > 0) return false;
    const punti = punteggioVoceBando(m.titolo, m.linkFonteUfficiale);
    return punti < SOGLIA_VOCE_BANDO;
  });

  const anteprima = daRimuovere.map((m) => ({ id: m.id, titolo: m.titolo, ente: m.ente, linkFonteUfficiale: m.linkFonteUfficiale }));

  if (opts.esegui && daRimuovere.length > 0) {
    await prisma.misura.deleteMany({ where: { id: { in: daRimuovere.map((m) => m.id) } } });
  }

  return {
    misureAutomaticheEsaminate: candidate.length,
    trovate: daRimuovere.length,
    eseguito: Boolean(opts.esegui),
    anteprima,
  };
}
