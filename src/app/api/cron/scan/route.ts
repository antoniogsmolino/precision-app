import { NextRequest, NextResponse } from "next/server";
import { scanFontiDovute } from "@/lib/monitoring/engine";

/**
 * Endpoint schedulato (Vercel Cron, vedi vercel.json — giornaliero) che
 * scansiona tutte le fonti attive dovute. Protetto da CRON_SECRET: non è
 * dietro il login del team (i cron esterni non hanno una sessione), ma
 * senza il segreto giusto risponde 401.
 *
 * Per un self-hosting non-Vercel: `npm run scan:sources` esegue lo stesso
 * motore da CLI, schedulabile con qualunque cron di sistema.
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto =
    req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const risultati = await scanFontiDovute();
  return NextResponse.json({ eseguitoAlle: new Date().toISOString(), risultati });
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;
