import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ricalcolaTuttiIMatch } from "@/lib/matching/engine";
import { REGIONI } from "@/lib/monitoring/parsers/regionale/config";
import { CAMERE_DI_COMMERCIO } from "@/lib/monitoring/parsers/camerale/config";

interface FonteSeed {
  nome: string;
  livello: "L1_NAZIONALE" | "L2_REGIONALE" | "L3_CAMERALE";
  regione?: string;
  url: string;
  parserKey: string;
}

/**
 * Logica di seed condivisa tra `prisma/seed.ts` (CLI, `npm run seed`) e
 * l'endpoint `/api/setup/seed` (per popolare un database di produzione
 * raggiungibile solo da un ambiente con accesso a Internet, es. Vercel).
 * Idempotente: rilanciarla non duplica utente/fonti, e i dati dimostrativi
 * vengono creati solo se non esistono già misure inserite manualmente.
 */
export async function eseguiSeed(prisma: PrismaClient) {
  const log: string[] = [];

  // --- Utente team MOLO -----------------------------------------------
  const emailAdmin = process.env.SEED_ADMIN_EMAIL ?? "team@molo4punto0.it";
  const passwordAdmin = process.env.SEED_ADMIN_PASSWORD ?? "molo4punto0!";
  const passwordHash = await bcrypt.hash(passwordAdmin, 10);

  await prisma.user.upsert({
    where: { email: emailAdmin },
    update: {},
    create: { name: "Team MOLO", email: emailAdmin, passwordHash },
  });
  log.push(`utente pronto: ${emailAdmin} (cambia la password dopo il primo accesso)`);

  // --- Fonti Fase 1 (Livello 1 nazionali + primo test camerale) -------
  const fonti: FonteSeed[] = [
    {
      nome: "incentivi.gov.it (MIMIT)",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.incentivi.gov.it/it/incentivi",
      parserKey: "incentivi-gov-it",
    },
    {
      // URL corretto verificato manualmente dal team (quello precedente,
      // /cosa-facciamo, è una pagina istituzionale generica senza elenco
      // bandi) — vedi anche la seconda fonte Invitalia poco sotto.
      nome: "Invitalia — Per le imprese",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.invitalia.it/per-le-imprese/incentivi-e-strumenti",
      parserKey: "invitalia",
    },
    {
      // Sezione distinta del sito Invitalia (chi vuole avviare un'impresa,
      // non solo imprese già esistenti) — stesso parser, URL diverso:
      // entrambe le sezioni hanno elenchi di incentivi propri, si tengono
      // separate per non perdere misure presenti solo in una delle due.
      nome: "Invitalia — Per chi vuole fare impresa",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.invitalia.it/per-chi-vuole-fare-impresa/incentivi-e-strumenti",
      parserKey: "invitalia-avvio-impresa",
    },
    {
      nome: "Unioncamere — Punto Impresa Digitale",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.puntoimpresadigitale.camcom.it",
      parserKey: "unioncamere-pid",
    },
    {
      // URL corretto verificato manualmente dal team (quello precedente,
      // /finanziamenti-agevolazioni, non è la pagina reale del sito).
      nome: "SIMEST",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.simest.it/per-le-imprese/finanziamenti-agevolati",
      parserKey: "simest",
    },
    {
      nome: "CCIAA Sud Est Sicilia",
      livello: "L3_CAMERALE" as const,
      regione: "Sicilia",
      url: "https://www.cciaasudestsicilia.it/bandi",
      parserKey: "cciaa-sud-est-sicilia",
    },
    // --- Fonti regionali (Livello 2): tutte le 20 Regioni, generate da
    // ../monitoring/parsers/regionale/config.ts. Sicilia è la prima
    // dell'elenco (territorio MOLO), ma sono tutte attive da subito.
    ...REGIONI.map((r) => ({
      nome: `${r.ente} — Bandi`,
      livello: "L2_REGIONALE" as const,
      regione: r.regione,
      url: r.url,
      parserKey: `regione-${r.slug}`,
    })),
    // --- Fonti camerali aggiuntive (Livello 3), oltre alla CCIAA Sud Est
    // Sicilia già sopra — generate da ../monitoring/parsers/camerale/config.ts.
    ...CAMERE_DI_COMMERCIO.map((c) => ({
      nome: `${c.ente} — Bandi`,
      livello: "L3_CAMERALE" as const,
      regione: c.regione,
      url: c.url,
      parserKey: `cciaa-${c.slug}`,
    })),
  ];

  // update NON è {}: nome/url/regione/livello vanno risincronizzati dal
  // codice ad ogni rilancio del seed, altrimenti una correzione di URL
  // (es. un dominio sbagliato scoperto dal team) non arriva mai alle fonti
  // già esistenti in produzione — solo alle nuove. Mai toccati invece i
  // campi operativi (attiva, frequenzaOreScan, stato scansione): quelli
  // restano sempre lavoro del team, mai sovrascritti da un reseed.
  for (const f of fonti) {
    await prisma.fonte.upsert({
      where: { parserKey: f.parserKey },
      update: { nome: f.nome, url: f.url, livello: f.livello, regione: f.regione ?? null },
      create: f,
    });
  }
  log.push(`${fonti.length} fonti pronte (nome/url risincronizzati dal codice se già esistenti)`);

  // --- Dati dimostrativi, utili per vedere subito la dashboard piena --
  const misureDemoCount = await prisma.misura.count({ where: { rilevataAutomaticamente: false } });
  const primoSeed = misureDemoCount === 0;
  if (primoSeed) {
    const oggi = new Date();
    const giorni = (n: number) => new Date(oggi.getTime() + n * 24 * 60 * 60 * 1000);

    const misureDemo = await Promise.all([
      prisma.misura.create({
        data: {
          titolo: "Credito d'imposta Transizione 5.0",
          ente: "MIMIT",
          categoria: "NAZIONALE",
          descrizioneBreve: "Credito d'imposta per investimenti in efficienza energetica e digitalizzazione 4.0/5.0.",
          descrizioneEstesa:
            "Sostiene gli investimenti in beni strumentali nuovi funzionali a progetti di innovazione che conseguono una riduzione dei consumi energetici. Cumulabile con altre misure nei limiti previsti dalla normativa.",
          tipoAgevolazione: "CREDITO_IMPOSTA",
          tipoValore: "PERCENTUALE",
          percentuale: 35,
          tettoMassimo: 5_000_000,
          dataApertura: giorni(-60),
          dataScadenza: giorni(20),
          atecoAmmessi: ["10", "13", "25", "28", "62"],
          regioniAmmesse: [],
          fatturatoMin: 0,
          fatturatoMax: 50_000_000,
          documentiRichiesti: ["Perizia tecnica asseverata", "Visura camerale", "DURC in corso di validità"],
          linkFonteUfficiale: "https://www.incentivi.gov.it",
          noteInterne: "Alta priorità: molte PMI del territorio potenzialmente idonee.",
        },
      }),
      prisma.misura.create({
        data: {
          titolo: "Resto al Sud",
          ente: "Invitalia",
          categoria: "NAZIONALE",
          descrizioneBreve: "Finanziamento agevolato per nuove attività imprenditoriali nel Mezzogiorno.",
          descrizioneEstesa:
            "Contributo a fondo perduto e finanziamento bancario a tasso zero per l'avvio di micro e piccole imprese in Sicilia e nelle altre regioni del Mezzogiorno.",
          tipoAgevolazione: "MISTO",
          tipoValore: "RANGE",
          importoMin: 50_000,
          importoMax: 300_000,
          dataApertura: giorni(-200),
          dataScadenza: giorni(400),
          regioniAmmesse: ["Sicilia", "Calabria", "Campania", "Puglia", "Basilicata", "Sardegna", "Molise", "Abruzzo"],
          dipendentiMax: 50,
          documentiRichiesti: ["Business plan", "Documento d'identità soci", "Certificato ISEE"],
          linkFonteUfficiale: "https://www.invitalia.it",
        },
      }),
      prisma.misura.create({
        data: {
          titolo: "Voucher Doppia Transizione",
          ente: "Unioncamere — Punto Impresa Digitale",
          categoria: "CAMERALE",
          descrizioneBreve: "Voucher a fondo perduto per digitalizzazione e sostenibilità delle PMI.",
          descrizioneEstesa:
            "Contributo per l'acquisizione di servizi di consulenza e formazione su transizione digitale ed ecologica, erogato tramite il sistema camerale.",
          tipoAgevolazione: "FONDO_PERDUTO",
          tipoValore: "PERCENTUALE",
          percentuale: 50,
          tettoMassimo: 10_000,
          dataApertura: giorni(-10),
          dataScadenza: giorni(5),
          fatturatoMax: 10_000_000,
          dipendentiMax: 250,
          documentiRichiesti: ["Iscrizione registro imprese", "Preventivo fornitore"],
          linkFonteUfficiale: "https://www.puntoimpresadigitale.camcom.it",
        },
      }),
      prisma.misura.create({
        data: {
          titolo: "Finanziamenti Internazionalizzazione PMI",
          ente: "SIMEST",
          categoria: "NAZIONALE",
          descrizioneBreve: "Finanziamenti a tasso agevolato per progetti di internazionalizzazione.",
          descrizioneEstesa:
            "Supporto finanziario per programmi di inserimento sui mercati esteri, partecipazione a fiere e e-commerce internazionale.",
          tipoAgevolazione: "TASSO_ZERO",
          tipoValore: "IMPORTO_FISSO",
          importoFisso: 200_000,
          dataApertura: giorni(30),
          dataScadenza: giorni(200),
          documentiRichiesti: ["Piano export", "Bilanci ultimi 2 esercizi"],
          linkFonteUfficiale: "https://www.simest.it",
        },
      }),
      prisma.misura.create({
        data: {
          titolo: "Bando Innovazione CCIAA Sud Est Sicilia",
          ente: "CCIAA Sud Est Sicilia",
          categoria: "CAMERALE",
          descrizioneBreve: "Contributi a fondo perduto per progetti di innovazione delle imprese siciliane.",
          descrizioneEstesa:
            "Sostegno a progetti di innovazione di prodotto/processo per le imprese con sede operativa nelle province di Catania, Ragusa e Siracusa.",
          tipoAgevolazione: "FONDO_PERDUTO",
          tipoValore: "RANGE",
          importoMin: 5_000,
          importoMax: 25_000,
          dataApertura: giorni(-400),
          dataScadenza: giorni(-30),
          regioniAmmesse: ["Sicilia"],
          documentiRichiesti: ["Relazione tecnica progetto", "Preventivi fornitori"],
          linkFonteUfficiale: "https://www.cciaasudestsicilia.it",
        },
      }),
    ]);

    await prisma.misura.update({
      where: { id: misureDemo[0].id },
      data: { cumulabiliComeA: { connect: { id: misureDemo[2].id } } },
    });
    await prisma.misura.update({
      where: { id: misureDemo[2].id },
      data: { cumulabiliComeB: { connect: { id: misureDemo[0].id } } },
    });

    log.push(`${misureDemo.length} misure dimostrative create`);

    const prospectDemo = await Promise.all([
      prisma.prospect.create({
        data: {
          ragioneSociale: "Meccanica Etnea S.r.l.",
          piva: "00000000010",
          ateco: "25.62.00",
          regione: "Sicilia",
          provincia: "CT",
          fatturato: 2_400_000,
          numeroDipendenti: 18,
          email: "info@meccanicaetnea.it",
          telefono: "095 0000000",
          fonteImport: "demo",
        },
      }),
      prisma.prospect.create({
        data: {
          ragioneSociale: "Ibleo Food S.p.A.",
          piva: "00000000020",
          ateco: "10.71.00",
          regione: "Sicilia",
          provincia: "RG",
          fatturato: 8_500_000,
          numeroDipendenti: 64,
          email: "amministrazione@ibleofood.it",
          fonteImport: "demo",
        },
      }),
      prisma.prospect.create({
        data: {
          ragioneSociale: "Aretusa Digital Solutions S.r.l.",
          piva: "00000000030",
          ateco: "62.01.00",
          regione: "Sicilia",
          provincia: "SR",
          fatturato: 650_000,
          numeroDipendenti: 7,
          email: "hello@aretusadigital.it",
          fonteImport: "demo",
        },
      }),
    ]);
    log.push(`${prospectDemo.length} prospect dimostrativi creati`);
  } else {
    log.push("misure già presenti: dati dimostrativi non ricreati");
  }

  // --- Ricalcolo match sui dati appena inseriti ------------------------
  const esito = await ricalcolaTuttiIMatch();
  log.push(
    `match ricalcolati: ${esito.matchTrovati} match tra ${esito.prospectValutati} prospect e ${esito.misureValutate} misure`,
  );

  // Solo al primo seed: valorizza qualche stato pratica di esempio, così il
  // pannello KPI non parte vuoto. Nei seed successivi non si tocca nulla —
  // lo stato pratica è lavoro del team, mai sovrascritto da un ricalcolo.
  if (primoSeed) {
    const matchDemo = await prisma.prospectMisuraMatch.findMany({ take: 3, orderBy: { calcolatoAt: "asc" } });
    if (matchDemo[0]) await prisma.prospectMisuraMatch.update({ where: { id: matchDemo[0].id }, data: { statoPratica: "CONTRATTO_ATTIVO" } });
    if (matchDemo[1]) await prisma.prospectMisuraMatch.update({ where: { id: matchDemo[1].id }, data: { statoPratica: "AMMESSA" } });
    if (matchDemo.length > 0) log.push("stato pratica di esempio impostato su alcuni match dimostrativi");
  }

  return { log, emailAdmin };
}
