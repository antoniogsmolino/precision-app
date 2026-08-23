import { z } from "zod";

const decimaleOpzionale = z.union([z.number(), z.null()]).optional();

export const misuraSchema = z.object({
  titolo: z.string().min(3, "Titolo troppo corto"),
  ente: z.string().min(2, "Ente obbligatorio"),
  categoria: z.enum(["NAZIONALE", "REGIONALE", "CAMERALE", "FISCALE"]),
  descrizioneBreve: z.string().min(5, "Descrizione breve obbligatoria"),
  descrizioneEstesa: z.string().min(5, "Descrizione estesa obbligatoria"),

  tipoAgevolazione: z.enum(["FONDO_PERDUTO", "TASSO_ZERO", "CREDITO_IMPOSTA", "MISTO"]),
  tipoValore: z.enum(["IMPORTO_FISSO", "RANGE", "PERCENTUALE"]),
  importoFisso: decimaleOpzionale,
  importoMin: decimaleOpzionale,
  importoMax: decimaleOpzionale,
  percentuale: decimaleOpzionale,
  tettoMassimo: decimaleOpzionale,

  dataApertura: z.coerce.date(),
  dataScadenza: z.coerce.date(),

  atecoAmmessi: z.array(z.string()).default([]),
  atecoEsclusi: z.array(z.string()).default([]),
  regioniAmmesse: z.array(z.string()).default([]),
  fatturatoMin: decimaleOpzionale,
  fatturatoMax: decimaleOpzionale,
  dipendentiMin: z.union([z.number().int(), z.null()]).optional(),
  dipendentiMax: z.union([z.number().int(), z.null()]).optional(),
  altriRequisiti: z.string().optional().nullable(),

  documentiRichiesti: z.array(z.string()).default([]),
  linkFonteUfficiale: z.string().url("Inserisci un URL valido"),
  noteInterne: z.string().optional().nullable(),

  cumulabiliIds: z.array(z.string()).default([]),
}).refine((data) => data.dataScadenza > data.dataApertura, {
  message: "La data di scadenza deve essere successiva alla data di apertura",
  path: ["dataScadenza"],
});

export type MisuraInput = z.infer<typeof misuraSchema>;

export const ITALIA_REGIONI = [
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige",
  "Umbria",
  "Valle d'Aosta",
  "Veneto",
];
