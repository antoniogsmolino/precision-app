import { NextResponse } from "next/server";
import { calcolaCoverage } from "@/lib/motore-bandi/coverage";

export const dynamic = "force-dynamic";

/** Coverage Monitor (specifica motore bandi, §38) — protetto dalla stessa sessione del resto della dashboard (middleware). */
export async function GET() {
  const rapporto = await calcolaCoverage();
  return NextResponse.json(rapporto);
}
