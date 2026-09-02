import { calcolaStatoMisura, type StatoMisura } from "./stato";

export interface MisuraFiltrabile {
  titolo?: string;
  ente?: string;
  categoria: string;
  tipoAgevolazione: string;
  dataApertura: string | Date;
  dataScadenza: string | Date;
  scadenzaStimata?: boolean;
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
  testoLibero: string;
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
  testoLibero: "",
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
    f.fonteIds.length > 0 ||
    f.testoLibero.trim() !== ""
  );
}

function valoreIndicativo(m: MisuraFiltrabile): number | null {
  const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));
  return n(m.importoFisso) ?? n(m.importoMax) ?? n(m.importoMin) ?? n(m.tettoMassimo);
}

export function filtraMisure<T extends MisuraFiltrabile>(misure: T[], f: FiltriMisure): T[] {
  return misure.filter((m) => {
    if (f.testoLibero.trim() !== "") {
      const query = f.testoLibero.trim().toLowerCase();
      const testo = `${m.titolo ?? ""} ${m.ente ?? ""}`.toLowerCase();
      if (!testo.includes(query)) return false;
    }

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

const PRIORITA_STATO: Record<StatoMisura, number> = {
  IN_SCADENZA: 0,
  ATTIVA: 1,
  FUTURA: 2,
  SCADUTA: 3,
};

/**
 * Ordina per urgenza reale invece che per data grezza: prima le misure con
 * una scadenza vera (in scadenza, poi attive, poi future, poi scadute in
 * fondo), a parità di stato le più vicine alla scadenza prima. Le misure
 * con `scadenzaStimata` (nessuna data reale trovata dal parser, solo un
 * segnaposto) vanno SEMPRE dopo tutte le altre: mischiarle in base a una
 * data inventata le farebbe sembrare più o meno urgenti di quanto si sappia
 * per certo.
 */
export function ordinaMisurePerUrgenza<T extends MisuraFiltrabile>(misure: T[]): T[] {
  return [...misure].sort((a, b) => {
    const stimataA = a.scadenzaStimata ? 1 : 0;
    const stimataB = b.scadenzaStimata ? 1 : 0;
    if (stimataA !== stimataB) return stimataA - stimataB;

    const statoA = calcolaStatoMisura(new Date(a.dataApertura), new Date(a.dataScadenza));
    const statoB = calcolaStatoMisura(new Date(b.dataApertura), new Date(b.dataScadenza));
    if (PRIORITA_STATO[statoA] !== PRIORITA_STATO[statoB]) return PRIORITA_STATO[statoA] - PRIORITA_STATO[statoB];

    return new Date(a.dataScadenza).getTime() - new Date(b.dataScadenza).getTime();
  });
}

/** I due criteri di ordinamento esposti in dashboard (specifica UI: "prima
 * i più vicini alla scadenza" oppure "prima i più recenti"). */
export type OrdinamentoMisure = "scadenza" | "uscita";

/**
 * Ordina per data di uscita (apertura) decrescente: i bandi più recenti
 * per primi. A differenza di `ordinaMisurePerUrgenza`, qui non c'è
 * priorità di stato — è un ordinamento puramente cronologico sulla data
 * di apertura, indipendente da quanto la misura sia "urgente" ora.
 */
export function ordinaMisurePerUscita<T extends MisuraFiltrabile>(misure: T[]): T[] {
  return [...misure].sort((a, b) => new Date(b.dataApertura).getTime() - new Date(a.dataApertura).getTime());
}
