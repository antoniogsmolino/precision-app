import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Crea (o, se l'email esiste già, aggiorna la password di) un account per
 * il tool — oltre all'utente team seedato da eseguiSeed. Serve a dare
 * accesso a un nuovo membro del team senza toccare l'utente esistente né
 * richiedere un altro giro di seed completo.
 *
 * Idempotente sull'email: rilanciarla con la stessa email/password non fa
 * danni, aggiorna solo l'hash della password (utile anche come "resetta
 * password" per un account che esiste già).
 */
export async function aggiungiUtente(
  prisma: PrismaClient,
  { nome, email, password }: { nome: string; email: string; password: string },
) {
  const passwordHash = await bcrypt.hash(password, 10);

  const utente = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: nome },
    create: { name: nome, email, passwordHash },
  });

  return { email: utente.email, nome: utente.name };
}
