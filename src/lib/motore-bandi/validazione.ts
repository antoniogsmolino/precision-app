import type { StatoPubblicazioneMisura } from "@prisma/client";
import type { BandoNormalizzato, CampoConEvidenza } from "./adapters/tipi";

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

/** Soglia minima di confidence sui campi critici per considerare un bando "verificato" (specifica, §29). */
const SOGLIA_CONFIDENCE_VERIFICATA = 0.9;

/**
 * Regole di pubblicazione (specifica, §29/§52): un bando entra
 * AUTO_VERIFICATA solo se tutti i campi critici PRESENTI hanno confidence
 * alta — un campo assente (valore null, "non trovato") non abbassa la
 * confidence, un campo presente ma incerto sì. Mai promuovere a PUBBLICATA
 * da qui: quello stato è riservato all'intervento umano/al vecchio motore
 * (che non calcola confidence per campo) — il nuovo motore propone al
 * massimo AUTO_VERIFICATA o segnala DA_VERIFICARE.
 */
export function calcolaStatoPubblicazione(bando: BandoNormalizzato): StatoPubblicazioneMisura {
  const campiCritici: CampoConEvidenza<unknown>[] = [
    bando.dataApertura,
    bando.dataScadenza,
    bando.tipoAgevolazione,
    bando.importoFisso,
    bando.importoMax,
    bando.percentuale,
    bando.tettoMassimo,
    bando.atecoAmmessi,
    bando.regioniAmmesse,
  ];

  const presenti = campiCritici.filter((c) => {
    if (c.valore === null || c.valore === undefined) return false;
    if (Array.isArray(c.valore)) return c.valore.length > 0;
    return true;
  });

  if (presenti.length === 0) return "DA_VERIFICARE";

  const confidenceMinima = Math.min(...presenti.map((c) => c.confidence));
  return confidenceMinima >= SOGLIA_CONFIDENCE_VERIFICATA ? "AUTO_VERIFICATA" : "DA_VERIFICARE";
}
