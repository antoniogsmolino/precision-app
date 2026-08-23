import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggiungiUtente } from "@/lib/setup/aggiungi-utente";

export const dynamic = "force-dynamic";

/**
 * Aggiunge un account per il tool oltre a quello seedato di default.
 * Protetto dallo stesso CRON_SECRET degli altri endpoint di setup, ma
 * VOLUTAMENTE via POST con secret/email/password nel body JSON, non nella
 * query string come gli altri endpoint di setup — qui il body contiene
 * una password, che nella query string finirebbe nella cronologia del
 * browser e nei log del server/proxy.
 *
 * Idempotente sull'email: richiamarlo con la stessa email aggiorna solo la
 * password di quell'account (utile anche per resettarla), non ne crea uno
 * duplicato.
 *
 * Esempio (da terminale, non dal browser):
 *   curl -X POST "https://<dominio>/api/setup/aggiungi-utente" \
 *     -H "Content-Type: application/json" \
 *     -d '{"secret":"...","nome":"...","email":"...","password":"..."}'
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const secretAtteso = process.env.CRON_SECRET;

  if (!secretAtteso || body?.secret !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const { nome, email, password } = body as { nome?: string; email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ errore: "email e password sono obbligatori" }, { status: 400 });
  }

  const utente = await aggiungiUtente(prisma, { nome: nome || email, email, password });
  return NextResponse.json({ ok: true, utente });
}
