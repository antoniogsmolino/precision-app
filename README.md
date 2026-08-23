# Radar Finanza Agevolata — MOLO 4.0

Radar interno per il team MOLO su bandi, incentivi e finanza agevolata, più
(dalla Fase 3) un frontend pubblico di lead generation collegato allo stesso
motore di matching.

Nessuna chiamata AI/LLM in nessun punto: il matching prospect↔misura è un
motore a regole (confronto di campi strutturati), a costo zero. **Il
matching è sempre indicativo, mai una garanzia di ammissione.**

### Design system

Palette e "Liquid Glass" definiti in `src/app/globals.css` (blocco `:root`)
e mappati su Tailwind in `tailwind.config.ts` — ricolorare il prodotto
significa editare quelle variabili, non i componenti:

- `--brand-600` = `#E41F25` (PRIMARY, pulsanti pieni) / `--brand-700`/`800` = `#C91F12` (hover e active)
- `--ink` = `#2B2E34` (titoli, testo, superfici scure)
- `--growth-*` = `#65BD7D` (progressi/risultati — testo sempre `ink`, mai bianco sopra)
- `--navigation-*` = `#198FD9` (info/orientamento)
- `--surface-alt` = `#F9F9FB` (sfondo pagina)
- `--urgency-*`: ambra introdotto per lo stato "in scadenza", per non
  confonderlo visivamente con il rosso PRIMARY riservato alle CTA

Superfici traslucide (`.glass-surface`, `.glass-surface-solid` in
`globals.css`, o `<CardGlass>` in `src/components/ui/card.tsx`) per
sidebar, header mobile, drawer e login.

## Stato del progetto

Questa build copre la **Fase 1** del piano a fasi concordato:

- Motore di monitoraggio automatico (fonti come tabella DB estensibile,
  parser dedicato per fonte, robots.txt, rate limit, ScanLog) su:
  - Livello 1 nazionale: incentivi.gov.it, Invitalia, Unioncamere/PID, SIMEST
  - Primo test camerale (Livello 3): CCIAA Sud Est Sicilia
- Pubblicazione diretta delle misure rilevate (nessuna coda di revisione)
- Form completo di creazione/modifica manuale misure (correzione errori,
  cumulabilità many-to-many)
- Import prospect da CSV con mappatura colonne configurabile a video
- Motore di matching a regole, ricalcolato ad ogni modifica
- Card dettaglio misura con prospect idonei esportabili in CSV
- Dashboard con timeline Gantt (vis-timeline) + filtri combinabili, applicati
  sia alla timeline sia alla vista elenco/card
- Login email/password (NextAuth, accesso unico per il team)

**Fase 2** aggiunge:

- Fonti regionali (Livello 2): Sicilia (priorità, territorio MOLO) +
  Lombardia, Lazio, Campania, Puglia. Le altre 15 Regioni si aggiungono
  progressivamente con lo stesso pattern — vedi
  `src/lib/monitoring/parsers/regionale/factory.ts`: una nuova regione è
  un file di ~8 righe che configura la factory, più la riga `Fonte` a DB.
- Timeline Gantt rifinita: zoom, preset di intervallo (3 mesi/6 mesi/1
  anno/tutto), skeleton di caricamento dedicato.
- Sezione "Scadenze imminenti" in home dashboard (misure che scadono
  entro 7/14/30 giorni, ordinate per urgenza).
- Pannello KPI (aziende candidate / ammesse / contratti attivi, per
  misura e in totale), con stato pratica aggiornabile dalla card
  dettaglio misura. Il ricalcolo dei match ora preserva lo stato pratica
  impostato dal team invece di azzerarlo ad ogni modifica.

Non ancora in questa build (fasi successive, da confermare una alla volta):
frontend pubblico "Finanza Agevolata Match" (Fase 3), Livello 3 camerale
oltre Sicilia (Fase 4), pipeline kanban (Fase 5 opzionale), le restanti 15
fonti regionali di Livello 2.

### Nota importante sui parser di monitoraggio

L'ambiente in cui questa build è stata sviluppata non ha accesso alla rete
pubblica (policy di sandboxing), quindi i selettori CSS dei 5 parser in
`src/lib/monitoring/parsers/` sono stati scritti **senza poter verificare
l'HTML reale** dei siti target — sono un best-effort documentato in testa a
ciascun file. Al primo scan reale (da un ambiente con accesso a Internet),
se una fonte non produce misure pur rispondendo con successo, è quasi
certamente un problema di selettori da calibrare in quel file — il resto del
motore (fetch, robots.txt, diffing, upsert, log, ricalcolo match) non va
toccato. Ogni scan fallito è comunque loggato in `ScanLog` con il messaggio
di errore, visibile nella pagina **Fonti monitorate** della dashboard.

## Stack

Next.js 14 (App Router) · TypeScript · Prisma + PostgreSQL · NextAuth
(credentials) · Tailwind CSS · vis-timeline · papaparse · cheerio ·
Resend (predisposto, usato dalla Fase 3 in poi)

## Setup locale

```bash
npm install
cp .env.example .env   # compila DATABASE_URL, NEXTAUTH_SECRET, ecc.

npx prisma migrate dev --name init   # crea lo schema sul tuo Postgres
npm run seed                          # utente team + fonti + dati dimostrativi

npm run dev
```

`npm run build` esegue anche `prisma migrate deploy`: richiede sempre
`DATABASE_URL` valorizzata (in locale come in produzione), e su un deploy
Vercel applica automaticamente lo schema al database ad ogni build — non
serve lanciare le migrazioni a mano dopo il primo deploy.

L'utente creato dal seed è stampato in console (default
`team@molo4punto0.it` / `molo4punto0!` — cambiala dopo il primo accesso, o
sovrascrivi `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` prima di seedare).

### Monitoraggio automatico

- **Vercel**: `vercel.json` configura un cron giornaliero su
  `/api/cron/scan`, protetto da `CRON_SECRET` (Vercel lo invia
  automaticamente come Bearer token quando la env var si chiama così).
- **Self-hosted**: `npm run scan:sources` esegue lo stesso motore da CLI,
  schedulabile con qualunque cron di sistema.
- **Manuale**: dalla dashboard → *Fonti monitorate* → "Scansiona ora" su
  ogni singola fonte.

### Aggiungere una nuova fonte

1. Scrivi `src/lib/monitoring/parsers/<nome-fonte>.ts` (contratto in
   `src/lib/monitoring/types.ts`).
2. Registra la chiave in `src/lib/monitoring/parsers/registry.ts`.
3. Crea la riga `Fonte` a DB con quel `parserKey` (via seed o — in una fase
   successiva — un form dedicato in dashboard).

Nessun'altra parte del motore va modificata.

## Comandi utili

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo |
| `npm run build` | Build di produzione (genera anche il client Prisma) |
| `npm run lint` / `npm run typecheck` | Qualità del codice |
| `npm run prisma:migrate` | Nuova migrazione in sviluppo |
| `npm run seed` | Popola utente team, fonti Fase 1, dati dimostrativi |
| `npm run scan:sources` | Esegue il motore di monitoraggio da CLI |
