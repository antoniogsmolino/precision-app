import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

/**
 * Azioni del backoffice di revisione (specifica motore bandi, §42) —
 * conferma/reject e override campo, con audit (chi/quando/perché,
 * specifica §42: "Ogni override umano deve avere user_id/timestamp/
 * reason"). Ogni azione scrive un EventoBando OVERRIDE_MANUALE, mai
 * silenziosa.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const utente = session?.user?.email ?? session?.user?.name ?? "sconosciuto";

  const body = await req.json().catch(() => ({}));
  const azione = body?.azione as string | undefined;
  const motivo = typeof body?.motivo === "string" && body.motivo.trim() ? body.motivo.trim() : undefined;

  const misura = await prisma.misura.findUnique({ where: { id: params.id } });
  if (!misura) return NextResponse.json({ errore: "Misura non trovata" }, { status: 404 });

  if (azione === "conferma_verifica") {
    await prisma.misura.update({ where: { id: params.id }, data: { statoPubblicazione: "PUBBLICATA" } });
    await prisma.eventoBando.create({
      data: {
        misuraId: params.id,
        tipo: "OVERRIDE_MANUALE",
        dettaglio: { utente, azione, motivo: motivo ?? "Confermata manualmente dal team", statoPrecedente: misura.statoPubblicazione, statoNuovo: "PUBBLICATA" },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (azione === "conferma_chiusura") {
    await prisma.misura.update({ where: { id: params.id }, data: { statoDichiarato: "CLOSED", assenzeConsecutive: 0 } });
    await prisma.eventoBando.create({
      data: {
        misuraId: params.id,
        tipo: "OVERRIDE_MANUALE",
        dettaglio: { utente, azione, motivo: motivo ?? "Chiusura confermata manualmente dopo sparizione dalla fonte", statoDichiaratoNuovo: "CLOSED" },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (azione === "ignora_assenza") {
    // Non è una chiusura: il team ha controllato e la misura è ancora
    // valida (sparizione temporanea/errore della fonte) — azzera il
    // contatore senza cambiare stato, per toglierla dalla coda di revisione.
    await prisma.misura.update({ where: { id: params.id }, data: { assenzeConsecutive: 0 } });
    await prisma.eventoBando.create({
      data: {
        misuraId: params.id,
        tipo: "OVERRIDE_MANUALE",
        dettaglio: { utente, azione, motivo: motivo ?? "Verificata manualmente: ancora valida nonostante l'assenza dalla fonte" },
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ errore: `Azione non riconosciuta: "${azione}"` }, { status: 400 });
}
