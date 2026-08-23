import { prisma } from "@/lib/prisma";

/**
 * La cumulabilità tra misure è una relazione simmetrica ("A è cumulabile con
 * B" implica "B è cumulabile con A"), ma Prisma modella le self-relation
 * many-to-many in modo direzionale (cumulabiliComeA / cumulabiliComeB).
 * Questi helper mantengono la simmetria scrivendo/leggendo sempre entrambe
 * le direzioni, così il resto dell'app può ignorare il dettaglio.
 */

export async function getMisureCumulabili(misuraId: string) {
  const misura = await prisma.misura.findUnique({
    where: { id: misuraId },
    include: {
      cumulabiliComeA: true,
      cumulabiliComeB: true,
    },
  });
  if (!misura) return [];
  const mappa = new Map<string, (typeof misura.cumulabiliComeA)[number]>();
  for (const m of [...misura.cumulabiliComeA, ...misura.cumulabiliComeB]) {
    mappa.set(m.id, m);
  }
  return [...mappa.values()];
}

/** Sostituisce l'intero elenco di misure cumulabili con `targetIds`, in entrambe le direzioni. */
export async function setMisureCumulabili(misuraId: string, targetIds: string[]) {
  const idsUnici = [...new Set(targetIds)].filter((id) => id !== misuraId);

  await prisma.$transaction(async (tx) => {
    // Scollega tutto quello che questa misura aveva prima (in entrambe le direzioni)
    const attuale = await tx.misura.findUnique({
      where: { id: misuraId },
      select: {
        cumulabiliComeA: { select: { id: true } },
        cumulabiliComeB: { select: { id: true } },
      },
    });
    const daScollegare = [
      ...(attuale?.cumulabiliComeA ?? []),
      ...(attuale?.cumulabiliComeB ?? []),
    ];

    await tx.misura.update({
      where: { id: misuraId },
      data: {
        cumulabiliComeA: { disconnect: daScollegare.map((m) => ({ id: m.id })) },
        cumulabiliComeB: { disconnect: daScollegare.map((m) => ({ id: m.id })) },
      },
    });

    if (idsUnici.length === 0) return;

    // Ricollega nella direzione "A" da questa misura...
    await tx.misura.update({
      where: { id: misuraId },
      data: { cumulabiliComeA: { connect: idsUnici.map((id) => ({ id })) } },
    });
    // ...e nella direzione "B" da ciascuna misura target, per rendere il match simmetrico.
    for (const targetId of idsUnici) {
      await tx.misura.update({
        where: { id: targetId },
        data: { cumulabiliComeB: { connect: { id: misuraId } } },
      });
    }
  });
}
