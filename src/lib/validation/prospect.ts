import { z } from "zod";

export const prospectSchema = z.object({
  ragioneSociale: z.string().min(2, "Ragione sociale obbligatoria"),
  piva: z.string().min(5, "Partita IVA obbligatoria"),
  ateco: z.string().optional().nullable(),
  regione: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  fatturato: z.union([z.number(), z.null()]).optional(),
  numeroDipendenti: z.union([z.number().int(), z.null()]).optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  telefono: z.string().optional().nullable(),
  fonteImport: z.string().optional().nullable(),
});

export type ProspectInput = z.infer<typeof prospectSchema>;

/** Campi interni verso cui l'utente mappa le colonne del CSV in import (sez. 2). */
export const CAMPI_PROSPECT_IMPORTABILI: { chiave: keyof ProspectInput; label: string; obbligatorio: boolean }[] = [
  { chiave: "ragioneSociale", label: "Ragione sociale", obbligatorio: true },
  { chiave: "piva", label: "Partita IVA", obbligatorio: true },
  { chiave: "ateco", label: "Codice ATECO", obbligatorio: false },
  { chiave: "regione", label: "Regione", obbligatorio: false },
  { chiave: "provincia", label: "Provincia", obbligatorio: false },
  { chiave: "fatturato", label: "Fatturato (€)", obbligatorio: false },
  { chiave: "numeroDipendenti", label: "Numero dipendenti", obbligatorio: false },
  { chiave: "email", label: "Email", obbligatorio: false },
  { chiave: "telefono", label: "Telefono", obbligatorio: false },
];
