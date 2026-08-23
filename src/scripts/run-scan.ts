/**
 * Runner da riga di comando per il motore di monitoraggio, per chi non usa
 * Vercel Cron: `npm run scan:sources`, schedulabile con qualunque cron di
 * sistema (es. `0 5 * * *` per un giro giornaliero alle 5 del mattino).
 */
import { scanFontiDovute } from "@/lib/monitoring/engine";

async function main() {
  console.log(`[scan] avvio ${new Date().toISOString()}`);
  const risultati = await scanFontiDovute();
  for (const r of risultati) {
    if (r.saltata) {
      console.log(`[scan] ${r.nome}: saltata (${r.motivoSalto})`);
    } else if (r.esito === "SUCCESSO") {
      console.log(`[scan] ${r.nome}: ok — ${r.misureNuove} nuove, ${r.misureAggiornate} aggiornate`);
    } else {
      console.log(`[scan] ${r.nome}: ${r.esito} — ${r.errore ?? ""}`);
    }
  }
  console.log(`[scan] completato ${new Date().toISOString()}`);
}

main()
  .catch((err) => {
    console.error("[scan] errore fatale", err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
