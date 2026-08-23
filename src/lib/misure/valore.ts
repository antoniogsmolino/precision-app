const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Tipo volutamente "largo": lato server i campi Decimal di Prisma arrivano
// come oggetto Decimal, lato client (dopo un round-trip JSON) come string.
// Number(...) gestisce entrambi i casi.
type ValoreNumerico = number | string | { toString(): string } | null | undefined;

interface ValoreMisuraLike {
  tipoValore: string;
  importoFisso?: ValoreNumerico;
  importoMin?: ValoreNumerico;
  importoMax?: ValoreNumerico;
  percentuale?: ValoreNumerico;
  tettoMassimo?: ValoreNumerico;
}

/** Etichetta leggibile del valore economico di una misura, qualunque sia la forma scelta. */
export function formatValoreMisura(m: ValoreMisuraLike): string {
  switch (m.tipoValore) {
    case "IMPORTO_FISSO":
      return m.importoFisso ? euro.format(Number(m.importoFisso)) : "Importo non specificato";
    case "RANGE":
      if (m.importoMin && m.importoMax) {
        return `${euro.format(Number(m.importoMin))} – ${euro.format(Number(m.importoMax))}`;
      }
      if (m.importoMax) return `fino a ${euro.format(Number(m.importoMax))}`;
      if (m.importoMin) return `da ${euro.format(Number(m.importoMin))}`;
      return "Importo non specificato";
    case "PERCENTUALE": {
      const pct = m.percentuale ? `${Number(m.percentuale)}%` : "% non specificata";
      return m.tettoMassimo ? `${pct} (tetto ${euro.format(Number(m.tettoMassimo))})` : pct;
    }
    default:
      return "Importo non specificato";
  }
}

/** Stima puntuale in euro usata dal motore di matching per il calcolo del
 * recupero potenziale stimato (frontend pubblico, fase 3). Restituisce il
 * valore massimo plausibile per prospect — sempre un'indicazione, mai una
 * promessa di importo ottenibile. */
export function stimaValoreMassimoMisura(m: ValoreMisuraLike, fatturatoProspect?: number | null): number {
  switch (m.tipoValore) {
    case "IMPORTO_FISSO":
      return m.importoFisso ? Number(m.importoFisso) : 0;
    case "RANGE":
      return m.importoMax ? Number(m.importoMax) : m.importoMin ? Number(m.importoMin) : 0;
    case "PERCENTUALE": {
      if (!m.percentuale) return 0;
      const base = fatturatoProspect ?? 0;
      const stimata = (Number(m.percentuale) / 100) * base;
      const tetto = m.tettoMassimo ? Number(m.tettoMassimo) : Infinity;
      return Math.min(stimata, tetto) || (m.tettoMassimo ? Number(m.tettoMassimo) : 0);
    }
    default:
      return 0;
  }
}

export const TIPO_AGEVOLAZIONE_LABEL: Record<string, string> = {
  FONDO_PERDUTO: "Fondo perduto",
  TASSO_ZERO: "Tasso zero",
  CREDITO_IMPOSTA: "Credito d'imposta",
  MISTO: "Misto",
};

export const CATEGORIA_LABEL: Record<string, string> = {
  NAZIONALE: "Nazionale",
  REGIONALE: "Regionale",
  CAMERALE: "Camerale",
  FISCALE: "Fiscale",
};
