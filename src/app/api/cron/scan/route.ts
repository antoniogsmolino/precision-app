import { NextRequest, NextResponse } from "next/server";
import { scanFontiDovute } from "@/lib/monitoring/engine";
import { ingestFontiDovute } from "@/lib/motore-bandi/ingest";

/**
 * Endpoint schedulato (Vercel Cron, vedi vercel.json — giornaliero) che
 * scansiona tutte le fonti attive dovute — sia quelle del vecchio motore
 * (parserKey, HTML) sia quelle del nuovo motore bandi (adapterKey, Open
 * Data/adapter strutturati): una fonte configurata con l'uno o l'altro
 * parte da sola allo stesso modo, nessun passo manuale in più. Protetto da
 * CRON_SECRET: non è dietro il login del team (i cron esterni non hanno
 * una sessione), ma senza il segreto giusto risponde 401.
 *
 * Per un self-hosting non-Vercel: `npm run scan:sources` esegue lo stesso
 * vecchio motore da CLI, schedulabile con qualunque cron di sistema.
 */
export async function GET(req: NextRequest) {
  const secretAtteso = process.env.CRON_SECRET;
  const secretRicevuto =
    req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");

  if (!secretAtteso || secretRicevuto !== secretAtteso) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const [risultatiVecchioMotore, risultatiMotoreBandi] = await Promise.all([scanFontiDovute(), ingestFontiDovute()]);
  return NextResponse.json({
    eseguitoAlle: new Date().toISOString(),
    risultati: risultatiVecchioMotore,
    risultatiMotoreBandi,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;
