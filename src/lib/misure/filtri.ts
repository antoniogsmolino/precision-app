import { calcolaStatoMisura, type StatoMisura } from "./stato";

export interface MisuraFiltrabile {
  categoria: string;
  tipoAgevolazione: string;
  dataApertura: string | Date;
  dataScadenza: string | Date;
  regioniAmmesse: string[];
  atecoAmmessi: string[];
  atecoEsclusi: string[];
  importoFisso?: number | string | null;
  importoMin?: number | string | null;
  importoMax?: number | string | null;
  percentuale?: number | string | null;
  tettoMassimo?: number | string | null;
  fonteId?: string | null;
}

export interface FiltriMisure {
  regioni: string[];
  categorie: string[];
  stati: StatoMisura[];
  tipiAgevolazione: string[];
  atecoSettore: string;
  importoMin: number | null;
  importoMax: number | null;
  fonteIds: string[];
}

export const FONTE_MANUALE_ID = "__manuale__";

export const FILTRI_VUOTI: FiltriMisure = {
  regioni: [],
  categorie: [],
  stati: [],
  tipiAgevolazione: [],
  atecoSettore: "",
  importoMin: null,
  importoMax: null,
  fonteIds: [],
};

export function haFiltriAttivi(f: FiltriMisure): boolean {
  return (
    f.regioni.length > 0 ||
    f.categorie.length > 0 ||
    f.stati.length > 0 ||
    f.tipiAgevolazione.length > 0 ||
    f.atecoSettore.trim() !== "" ||
    f.importoMin != null ||
    f.importoMax != null ||
    f.fonteIds.length > 0
  );
}

function valoreIndicativo(m: MisuraFiltrabile): number | null {
  const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));
  return n(m.importoFisso) ?? n(m.importoMax) ?? n(m.importoMin) ?? n(m.tettoMassimo);
}

export function filtraMisure<T extends MisuraFiltrabile>(misure: T[], f: FiltriMisure): T[] {
  return misure.filter((m) => {
    const stato = calcolaStatoMisura(new Date(m.dataApertura), new Date(m.dataScadenza));
    if (f.stati.length > 0 && !f.stati.includes(stato)) return false;

    if (f.categorie.length > 0 && !f.categorie.includes(m.categoria)) return false;

    if (f.tipiAgevolazione.length > 0 && !f.tipiAgevolazione.includes(m.tipoAgevolazione)) return false;

    if (f.regioni.length > 0 && m.regioniAmmesse.length > 0) {
      const intersecano = m.regioniAmmesse.some((r) => f.regioni.includes(r));
      if (!intersecano) return false;
    }

    if (f.atecoSettore.trim() !== "") {
      const query = f.atecoSettore.replace(/[.\s]/g, "").toUpperCase();
      const escluso = m.atecoEsclusi.some((c) => query.startsWith(c.replace(/[.\s]/g, "").toUpperCase()));
      if (escluso) return false;
      if (m.atecoAmmessi.length > 0) {
        const ammesso = m.atecoAmmessi.some((c) => query.startsWith(c.replace(/[.\s]/g, "").toUpperCase()));
        if (!ammesso) return false;
      }
    }

    const valore = valoreIndicativo(m);
    if (valore != null) {
      if (f.importoMin != null && valore < f.importoMin) return false;
      if (f.importoMax != null && valore > f.importoMax) return false;
    }

    if (f.fonteIds.length > 0) {
      const idFonte = m.fonteId ?? FONTE_MANUALE_ID;
      if (!f.fonteIds.includes(idFonte)) return false;
    }

    return true;
  });
}
