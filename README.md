# Radar Finanza Agevolata — MOLO 4.0

Radar interno per il team MOLO su bandi, incentivi e finanza agevolata, più
(dalla Fase 3) un frontend pubblico di lead generation collegato allo stesso
motore di matching.

Nessuna chiamata AI/LLM in nessun punto: il matching prospect↔misura è un
motore a regole (confronto di campi strutturati), a costo zero. **Il
matching è sempre indicativo, mai una garanzia di ammissione.**

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

Non ancora in questa build (fasi successive, da confermare una alla volta):
Livello 2 regionale (20 Regioni), alert scadenze e pannello KPI (Fase 2),
frontend pubblico "Finanza Agevolata Match" (Fase 3), Livello 3 camerale
oltre Sicilia (Fase 4), pipeline kanban (Fase 5 opzionale).

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
