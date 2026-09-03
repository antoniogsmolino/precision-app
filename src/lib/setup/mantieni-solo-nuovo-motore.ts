import type { PrismaClient } from "@prisma/client";

/**
 * Azione una tantum, su richiesta esplicita del team (03/09/2026): passare
 * da "vecchio motore (scraper HTML per fonte) + nuovo motore bandi
 * (adapter Open Data)" a SOLO il nuovo motore — l'unica fonte che resta
 * attiva è quella con adapterKey "incentivi-gov-open-data" (Solr JSON di
 * incentivi.gov.it). Sonar (dashboard interna) e la landing pubblica
 * condividono la stessa tabella Misura e lo stesso motore di matching:
 * questa pulizia vale per entrambi allo stesso modo, senza bisogno di
 * codice separato.
 *
 * Due effetti, entrambi necessari:
 *
 *  1. Disattiva (Fonte.attiva = false) ogni Fonte diversa da quella del
 *     nuovo motore. `scanFontiDovute` (vecchio motore) e
 *     `ingestFontiDovute` (nuovo motore) filtrano già per `attiva: true`
 *     — disattivare basta a fermare sia il cron giornaliero sia il
 *     pulsante "Scansiona tutte ora", senza toccare codice.
 *
 *  2. Cancella ogni Misura rilevata automaticamente che NON viene dalla
 *     fonte tenuta (fonteId nullo, o di una fonte diversa) — il residuo
 *     del vecchio motore (es. "Incentivi", un titolo generico da un link
 *     di navigazione mai filtrato correttamente). Cancellazione reale,
 *     non archiviazione: il team ha chiesto che sparisca del tutto, anche
 *     dalla dashboard interna, non solo dal matching pubblico. La
 *     cancellazione fa cascata sui ProspectMisuraMatch collegati (nessun
 *     record orfano) — se una misura aveva già ricevuto dei match da lead
 *     reali, anche quei match vengono rimossi: è la richiesta esplicita
 *     ("deve sparire totalmente"), non un effetto collaterale accidentale.
 *
 * NON tocca MAI le misure inserite a mano dal team
 * (rilevataAutomaticamente: false) — quelle non sono "vecchio motore",
 * sono lavoro deliberato e restano, a prescindere dalla fonte.
 *
 * Sempre in modalità "anteprima" per default (nessuna scrittura), stesso
 * pattern degli altri endpoint di setup: il chiamante deve passare
 * esplicitamente `esegui: true` per applicare davvero.
 */
const ADAPTER_KEY_DA_TENERE = "incentivi-gov-open-data";

export async function mantieniSoloNuovoMotore(prisma: PrismaClient, opts: { esegui?: boolean } = {}) {
  const fontiDaTenere = await prisma.fonte.findMany({ where: { adapterKey: ADAPTER_KEY_DA_TENERE } });
  if (fontiDaTenere.length === 0) {
    return {
      errore: `Nessuna Fonte con adapterKey="${ADAPTER_KEY_DA_TENERE}" trovata — niente da fare, controlla che il seed sia stato eseguito.`,
    };
  }
  const idsFontiDaTenere = fontiDaTenere.map((f) => f.id);

  const altreFontiAttive = await prisma.fonte.findMany({
    where: { attiva: true, id: { notIn: idsFontiDaTenere } },
    select: { id: true, nome: true, livello: true, regione: true },
    orderBy: { nome: "asc" },
  });

  const misureDaRimuovere = await prisma.misura.findMany({
    where: {
      rilevataAutomaticamente: true,
      OR: [{ fonteId: null }, { fonteId: { notIn: idsFontiDaTenere } }],
    },
    select: { id: true, titolo: true, ente: true, fonteId: true, _count: { select: { matches: true } } },
  });

  if (opts.esegui) {
    if (altreFontiAttive.length > 0) {
      await prisma.fonte.updateMany({
        where: { id: { in: altreFontiAttive.map((f) => f.id) } },
        data: { attiva: false },
      });
    }
    if (misureDaRimuovere.length > 0) {
      await prisma.misura.deleteMany({ where: { id: { in: misureDaRimuovere.map((m) => m.id) } } });
    }
  }

  return {
    eseguito: Boolean(opts.esegui),
    fonteTenuta: fontiDaTenere.map((f) => ({ id: f.id, nome: f.nome })),
    fontiDaDisattivare: altreFontiAttive.length,
    anteprimaFontiDaDisattivare: altreFontiAttive.map((f) => ({ nome: f.nome, livello: f.livello, regione: f.regione })),
    misureDaRimuovere: misureDaRimuovere.length,
    misureConMatchGiaEsistenti: misureDaRimuovere.filter((m) => m._count.matches > 0).length,
    anteprimaMisureDaRimuovere: misureDaRimuovere.slice(0, 50).map((m) => ({ id: m.id, titolo: m.titolo, ente: m.ente })),
  };
}
