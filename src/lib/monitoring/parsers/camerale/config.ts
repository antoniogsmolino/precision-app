/**
 * Batch esteso di Camere di Commercio provinciali/territoriali, oltre alla
 * CCIAA Sud Est Sicilia (che ha un file a sé, vedi ../cciaa-sud-est-sicilia.ts).
 * Selezionate per densità di imprese (grandi aree metropolitane/industriali),
 * per dare da subito una copertura camerale ampia su tutto il Paese invece
 * che su una sola fonte.
 *
 * NOTA DI CALIBRAZIONE (stessa di regionale/config.ts): dominio e URL sono
 * il miglior tentativo senza accesso alla rete pubblica da questo ambiente.
 * Il sistema camerale italiano ha accorpato molte Camere di Commercio dal
 * 2018 in poi, quindi alcuni domini "per provincia" potrebbero essere
 * cambiati nome nel frattempo — se una fonte camerale risulta con errore di
 * connessione (fonti → scan log), è quasi certamente un dominio da
 * aggiornare qui, non un problema del motore. Aggiungerne altre (sono oltre
 * 60 in tutta Italia dopo gli accorpamenti) significa aggiungere righe qui,
 * in base a priorità di business — non tutte insieme.
 */
export interface ConfigCamerale {
  slug: string;
  ente: string;
  regione: string;
  url: string;
}

export const CAMERE_DI_COMMERCIO: ConfigCamerale[] = [
  { slug: "milano-monza-brianza-lodi", ente: "CCIAA Milano Monza Brianza Lodi", regione: "Lombardia", url: "https://www.milomb.camcom.it" },
  { slug: "roma", ente: "CCIAA Roma", regione: "Lazio", url: "https://www.rm.camcom.it" },
  { slug: "napoli", ente: "CCIAA Napoli", regione: "Campania", url: "https://www.na.camcom.it" },
  { slug: "torino", ente: "CCIAA Torino", regione: "Piemonte", url: "https://www.to.camcom.it" },
  { slug: "bologna", ente: "CCIAA Bologna", regione: "Emilia-Romagna", url: "https://www.bo.camcom.it" },
  { slug: "firenze", ente: "CCIAA Firenze", regione: "Toscana", url: "https://www.fi.camcom.it" },
  { slug: "bari", ente: "CCIAA Bari", regione: "Puglia", url: "https://www.ba.camcom.it" },
  { slug: "palermo-enna", ente: "CCIAA Palermo Enna", regione: "Sicilia", url: "https://www.pa.camcom.it" },
  { slug: "genova", ente: "CCIAA Genova", regione: "Liguria", url: "https://www.ge.camcom.it" },
  { slug: "verona", ente: "CCIAA Verona", regione: "Veneto", url: "https://www.vr.camcom.it" },
  { slug: "padova", ente: "CCIAA Padova", regione: "Veneto", url: "https://www.pd.camcom.it" },
  { slug: "bergamo", ente: "CCIAA Bergamo", regione: "Lombardia", url: "https://www.bg.camcom.it" },
  { slug: "brescia", ente: "CCIAA Brescia", regione: "Lombardia", url: "https://www.bs.camcom.it" },
  { slug: "vicenza", ente: "CCIAA Vicenza", regione: "Veneto", url: "https://www.vi.camcom.it" },
  { slug: "salerno", ente: "CCIAA Salerno", regione: "Campania", url: "https://www.sa.camcom.it" },
  { slug: "bolzano", ente: "CCIAA Bolzano", regione: "Trentino-Alto Adige", url: "https://www.bz.camcom.it" },
  { slug: "trento", ente: "CCIAA Trento", regione: "Trentino-Alto Adige", url: "https://www.tn.camcom.it" },
  { slug: "cagliari", ente: "CCIAA Cagliari-Oristano", regione: "Sardegna", url: "https://www.ca.camcom.it" },
  { slug: "reggio-calabria", ente: "CCIAA Reggio Calabria", regione: "Calabria", url: "https://www.rc.camcom.it" },
  { slug: "ancona", ente: "CCIAA Marche (Ancona)", regione: "Marche", url: "https://www.an.camcom.gov.it" },
];
