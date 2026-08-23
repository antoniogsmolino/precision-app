/**
 * Elenco delle 20 Regioni italiane, ciascuna con il proprio dominio
 * istituzionale ufficiale. Sicilia per prima (territorio MOLO), poi le
 * altre in ordine alfabetico — nessuna priorità di business tra loro,
 * sono tutte attive fin da subito: il radar copre tutto il Paese.
 *
 * NOTA DI CALIBRAZIONE: puntano all'homepage istituzionale (non a un URL
 * "/bandi" specifico) perché senza accesso alla rete pubblica da questo
 * ambiente di sviluppo non è possibile verificare il percorso esatto della
 * sezione bandi di ciascun sito — puntare all'homepage evita un 404 secco
 * e lascia comunque al motore euristico (estraiVociListaEuristica in
 * ../shared.ts) la possibilità di trovare i link ai bandi dal menu
 * principale. Se una fonte non produce risultati utili, il modo più
 * rapido per migliorarla è aggiornare qui il campo `url` con l'indirizzo
 * esatto della pagina bandi, verificato dal team con accesso reale al sito.
 */
export interface ConfigRegione {
  slug: string;
  ente: string;
  regione: string;
  url: string;
}

export const REGIONI: ConfigRegione[] = [
  { slug: "sicilia", ente: "Regione Siciliana", regione: "Sicilia", url: "https://www.regione.sicilia.it" },
  { slug: "abruzzo", ente: "Regione Abruzzo", regione: "Abruzzo", url: "https://www.regione.abruzzo.it" },
  { slug: "basilicata", ente: "Regione Basilicata", regione: "Basilicata", url: "https://www.regione.basilicata.it" },
  { slug: "calabria", ente: "Regione Calabria", regione: "Calabria", url: "https://www.regione.calabria.it" },
  { slug: "campania", ente: "Regione Campania", regione: "Campania", url: "https://www.regione.campania.it" },
  {
    slug: "emilia-romagna",
    ente: "Regione Emilia-Romagna",
    regione: "Emilia-Romagna",
    url: "https://www.regione.emilia-romagna.it",
  },
  {
    slug: "friuli-venezia-giulia",
    ente: "Regione Friuli Venezia Giulia",
    regione: "Friuli-Venezia Giulia",
    url: "https://www.regione.fvg.it",
  },
  { slug: "lazio", ente: "Regione Lazio", regione: "Lazio", url: "https://www.regione.lazio.it" },
  { slug: "liguria", ente: "Regione Liguria", regione: "Liguria", url: "https://www.regione.liguria.it" },
  { slug: "lombardia", ente: "Regione Lombardia", regione: "Lombardia", url: "https://www.regione.lombardia.it" },
  { slug: "marche", ente: "Regione Marche", regione: "Marche", url: "https://www.regione.marche.it" },
  { slug: "molise", ente: "Regione Molise", regione: "Molise", url: "https://www.regione.molise.it" },
  { slug: "piemonte", ente: "Regione Piemonte", regione: "Piemonte", url: "https://www.regione.piemonte.it" },
  { slug: "puglia", ente: "Regione Puglia", regione: "Puglia", url: "https://www.regione.puglia.it" },
  { slug: "sardegna", ente: "Regione Sardegna", regione: "Sardegna", url: "https://www.regione.sardegna.it" },
  { slug: "toscana", ente: "Regione Toscana", regione: "Toscana", url: "https://www.regione.toscana.it" },
  // Trentino-Alto Adige: le competenze sono delle due Province Autonome, non
  // di un unico ente regionale operativo — due fonti distinte.
  {
    slug: "trento",
    ente: "Provincia Autonoma di Trento",
    regione: "Trentino-Alto Adige",
    url: "https://www.provincia.tn.it",
  },
  {
    slug: "bolzano",
    ente: "Provincia Autonoma di Bolzano",
    regione: "Trentino-Alto Adige",
    url: "https://www.provincia.bz.it",
  },
  { slug: "umbria", ente: "Regione Umbria", regione: "Umbria", url: "https://www.regione.umbria.it" },
  { slug: "valle-d-aosta", ente: "Regione Valle d'Aosta", regione: "Valle d'Aosta", url: "https://www.regione.vda.it" },
  { slug: "veneto", ente: "Regione Veneto", regione: "Veneto", url: "https://www.regione.veneto.it" },
];
