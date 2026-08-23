import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ricalcolaTuttiIMatch } from "@/lib/matching/engine";

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
  const fonti = [
    {
      nome: "incentivi.gov.it (MIMIT)",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.incentivi.gov.it/it/incentivi",
      parserKey: "incentivi-gov-it",
    },
    {
      nome: "Invitalia",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.invitalia.it/cosa-facciamo",
      parserKey: "invitalia",
    },
    {
      nome: "Unioncamere — Punto Impresa Digitale",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.puntoimpresadigitale.camcom.it",
      parserKey: "unioncamere-pid",
    },
    {
      nome: "SIMEST",
      livello: "L1_NAZIONALE" as const,
      url: "https://www.simest.it/finanziamenti-agevolazioni",
      parserKey: "simest",
    },
    {
      nome: "CCIAA Sud Est Sicilia",
      livello: "L3_CAMERALE" as const,
      regione: "Sicilia",
      url: "https://www.cciaasudestsicilia.it/bandi",
      parserKey: "cciaa-sud-est-sicilia",
    },
    // --- Fase 2: fonti regionali (Livello 2). Sicilia come priorità
    // (territorio MOLO), poi le regioni a maggiore densità di imprese.
    // Le restanti Regioni si aggiungono progressivamente (vedi README).
    {
      nome: "Regione Sicilia — Bandi",
      livello: "L2_REGIONALE" as const,
      regione: "Sicilia",
      url: "https://www.regione.sicilia.it/la-regione-informa/bandi",
      parserKey: "regione-sicilia",
    },
    {
      nome: "Regione Lombardia — Bandi",
      livello: "L2_REGIONALE" as const,
      regione: "Lombardia",
      url: "https://www.regione.lombardia.it/wps/portal/istituzionale/HP/bandi",
      parserKey: "regione-lombardia",
    },
    {
      nome: "Regione Lazio — Bandi",
      livello: "L2_REGIONALE" as const,
      regione: "Lazio",
      url: "https://www.regione.lazio.it/bandi-e-avvisi",
      parserKey: "regione-lazio",
    },
    {
      nome: "Regione Campania — Bandi",
      livello: "L2_REGIONALE" as const,
      regione: "Campania",
      url: "https://www.regione.campania.it/regione/it/tags/bandi",
      parserKey: "regione-campania",
    },
    {
      nome: "Regione Puglia — Bandi",
      livello: "L2_REGIONALE" as const,
      regione: "Puglia",
      url: "https://www.regione.puglia.it/bandi",
      parserKey: "regione-puglia",
    },
  ];

  for (const f of fonti) {
    await prisma.fonte.upsert({ where: { parserKey: f.parserKey }, update: {}, create: f });
  }
  log.push(`${fonti.length} fonti pronte (in pausa finché non lanci il primo scan)`);

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
