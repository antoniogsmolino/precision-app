import type { BandoNormalizzato } from "./adapters/tipi";

/**
 * Validazioni deterministiche (specifica tecnica motore bandi, §28) — MAI
 * delegate all'AI/all'adapter: un bando che viola una di queste regole non
 * va scritto così com'è, va segnalato. Qui la versione minima applicabile
 * ai campi che l'adapter Incentivi.gov.it già normalizza; si arricchisce
 * quando arrivano adapter con più campi da controllare (task "pipeline
 * estrazione evidence-first + validatore deterministico").
 */
export interface EsitoValidazione {
  valido: boolean;
  errori: string[];
}

export function validaBandoNormalizzato(bando: BandoNormalizzato): EsitoValidazione {
  const errori: string[] = [];

  const apertura = bando.dataApertura.valore;
  const scadenza = bando.dataScadenza.valore;
  if (apertura && scadenza && apertura.getTime() > scadenza.getTime()) {
    errori.push(`dataApertura (${apertura.toISOString()}) successiva a dataScadenza (${scadenza.toISOString()})`);
  }

  const percentuale = bando.percentuale.valore;
  if (percentuale !== null && (percentuale < 0 || percentuale > 100)) {
    errori.push(`percentuale fuori range 0-100: ${percentuale}`);
  }

  for (const [nome, valore] of [
    ["importoFisso", bando.importoFisso.valore],
    ["importoMax", bando.importoMax.valore],
    ["tettoMassimo", bando.tettoMassimo.valore],
  ] as const) {
    if (valore !== null && valore < 0) {
      errori.push(`${nome} negativo: ${valore}`);
    }
  }

  if (!bando.titolo.valore || bando.titolo.valore.trim().length === 0) {
    errori.push("titolo mancante");
  }

  try {
    if (bando.linkFonteUfficiale.valore) new URL(bando.linkFonteUfficiale.valore);
  } catch {
    errori.push(`linkFonteUfficiale non è un URL valido: ${bando.linkFonteUfficiale.valore}`);
  }

  return { valido: errori.length === 0, errori };
}
