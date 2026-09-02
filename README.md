# Radar Finanza Agevolata — MOLO 4.0

Radar interno per il team MOLO su bandi, incentivi e finanza agevolata, più
(dalla Fase 3) un frontend pubblico di lead generation collegato allo stesso
motore di matching.

Il matching prospect↔misura resta sempre un motore a regole (confronto di
campi strutturati), zero chiamate AI/LLM — **è sempre indicativo, mai una
garanzia di ammissione.** L'unico punto che usa un giudizio automatico
(Claude, opzionale) è il monitoraggio delle fonti, come secondo filtro
dopo quello a regole — vedi "Filtro di rilevanza AI" più sotto.

### Design system

Definito in `src/app/globals.css` (blocco `:root`) e mappato su Tailwind in
`tailwind.config.ts` — ricolorare il prodotto significa editare quelle
variabili, non i componenti:

- `--brand-600` = `#E41F25` (PRIMARY) / `--brand-700`/`800` = `#C91F12`
  (PRIMARY HOVER) — token dati esplicitamente dalla specifica UI del team
  ("SaaS Layout Specification"). **Nota**: un documento precedente
  (estrazione del design system dal sito pubblico moloquattropuntozero.it)
  indicava `#FF2D16` come rosso reale del sito — le due fonti si
  contraddicono su questo valore; scelto `#E41F25` perché è il più recente
  e il più esplicito per la UI di questo prodotto specifico. Correggibile
  in un punto solo se non è la scelta giusta.
- `--ink` = `#2B2E34` (titoli, testo, superfici scure)
- `--growth-*` = `#65BD7D` (testo sempre `ink` sopra, mai bianco)
- `--navigation-*` = `#198FD9`
- `--ocra-*` = `#E4A858` (terzo accento per varietà nelle card)
- `--surface-alt` = `#F9F9FB` / `--surface-muted` = `#F2F3F5`
- `--urgency-*`: ambra per lo stato "in scadenza", per non confonderlo
  visivamente col rosso PRIMARY (riservato alle CTA)
- Font **Poppins** (era Inter) — la specifica UI più recente suggerisce
  Inter/Manrope/DM Sans per il *carattere* del riferimento, ma Poppins è
  quello verificato come font realmente in uso sul sito pubblico MOLO:
  scelta deliberata di tenerlo, il "carattere pulito neo-grotesk" richiesto
  dalla specifica non dipende da quale delle due famiglie si usa.

**App shell** (`(dashboard)/layout.tsx`): su desktop l'intera dashboard
vive dentro un'unica superficie flottante con angoli molto arrotondati
(`rounded-[28px]`, margine 16px, altezza fissa `100vh - 32px`) — non un
semplice sfondo pieno pagina. Su mobile niente shell (pagina piena, come
prima). Dentro lo shell, sidebar a **due rail scure** (icone + statistiche/
navigazione, `icon-rail.tsx`/`stat-tiles.tsx`) e main a scroll indipendente
dalla sidebar.

**Gerarchia dei raggi** (non uniforme: più un componente è grande, più il
raggio è generoso — vedi commenti in `tailwind.config.ts`): `3xl` (28px)
solo per l'app shell più esterna; `2xl` (22px) per le card di contenuto
principali (`<Card>`); `xl` (18px) per card piccole/medie (stat tile);
pulsanti e badge restano a `rounded-full`. Selezione (voce di nav attiva)
sempre a **background pieno** (`bg-brand-600`), mai solo un bordo/tinta.

Superfici traslucide (`.glass-surface`, `.glass-surface-solid` in
`globals.css`, o `<CardGlass>` in `src/components/ui/card.tsx`) restano per
login e header mobile. `<Card tono="...">`
(`chiaro`/`scuro`/`growth`/`navigation`/`ocra`/`brand`) per superfici
colorate piene — varianti interne al componente, non className passata
dall'esterno (vedi il commento in `card.tsx` sul perché).

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

- Timeline Gantt rifinita: zoom, preset di intervallo (3 mesi/6 mesi/1
  anno/tutto), skeleton di caricamento dedicato.
- Sezione "Scadenze imminenti" in home dashboard (misure che scadono
  entro 7/14/30 giorni, ordinate per urgenza).
- Pannello KPI (aziende candidate / ammesse / contratti attivi, per
  misura e in totale), con stato pratica aggiornabile dalla card
  dettaglio misura. Il ricalcolo dei match ora preserva lo stato pratica
  impostato dal team invece di azzerarlo ad ogni modifica.
- **Copertura fonti estesa a tutte le 46**: 4 nazionali + tutte le 20
  Regioni (21 fonti, Trentino-Alto Adige contando le due Province Autonome
  separatamente) + 21 Camere di Commercio (CCIAA Sud Est Sicilia più un
  batch di 20 tra le principali per densità di imprese). Vedi
  `src/lib/monitoring/parsers/regionale/config.ts` e `.../camerale/config.ts`
  — una fonte in più è una riga di configurazione, il parser viene generato
  automaticamente dalla factory (`regionale/factory.ts`, `camerale/factory.ts`).
- **Estrazione a due livelli** (`estraiVociListaGenerico` in
  `src/lib/monitoring/parsers/shared.ts`): prova prima i selettori CSS
  specifici del sito, poi esegue *sempre* anche una scansione euristica su
  tutti i link della pagina, basata su parole chiave tipiche di un
  bando/avviso (non su classi/id) — così una fonte mai calibrata a mano
  restituisce comunque qualcosa invece di tornare a mani vuote. Bias
  volutamente verso il recall ("trovarle tutte"): qualche falso positivo in
  più si corregge in un attimo con "Segnala errore", una misura mai vista
  invece sfugge del tutto al radar.
- Pulsante "Scansiona tutte ora" in **Fonti monitorate**, con riepilogo
  (fonti totali / ultimo scan ok / in errore / mai scansionate / misure
  rilevate) e filtri per livello ed esito — utile per calibrare le fonti
  subito dopo un deploy invece di aspettare il primo giro di cron.
- Logo ufficiale "Sonar 4.0" (`public/logo-icon.png`, `public/logo-full.png`)
  integrato in login, sidebar, header mobile e favicon.

**Dopo il primo scan reale su tutte le fonti (calibrazione post-deploy)**,
tre correzioni fatte sui dati emersi dal primo giro:

- **Precisione dell'estrazione**: prima il filtro di rilevanza
  (`punteggioVoceBando`) si applicava solo alla scansione euristica — i link
  trovati tramite selettore CSS (incluso il selettore generico di ultima
  istanza `main a[href]`, usato quando i selettori specifici del sito non
  matchano nulla) passavano senza alcun filtro, catturando qualunque link
  nel contenuto principale della pagina: news, eventi culturali, servizi
  (bollo auto, aste immobiliari...), non solo bandi. Ora il filtro è un gate
  unico applicato SEMPRE, indipendentemente da quale dei due percorsi trova
  il link, con soglia più alta (richiede un segnale forte: parola chiave di
  dominio o URL in un percorso tipico `/bandi/`, `/avvisi/`...).
- **Niente più scadenze finte spacciate per reali**: quando un parser non
  trova una data di scadenza leggibile nella pagina, il motore doveva comunque
  valorizzare il campo (obbligatorio a schema) con un segnaposto
  ("oggi + 1 anno") — prima questo restava indistinguibile da una scadenza
  vera, facendo sembrare (anche in timeline) che decine di misure scadessero
  tutte lo stesso giorno. Ora è tracciato esplicitamente
  (`Misura.scadenzaStimata`), mostrato in UI con badge "Data da verificare",
  ed **escluso** dal pannello "Scadenze imminenti" e dall'ordinamento per
  urgenza (non essendo una scadenza vera, non deve mai sembrare più o meno
  urgente di quanto si sappia per certo).
- **Vista di default cambiata da Timeline a Elenco**: con centinaia di
  misure reali una Gantt diventa illeggibile (barre accavallate, scale
  fitte) — l'Elenco (ordinato per urgenza reale: in scadenza → attive →
  future → scadute, le "data da verificare" sempre in fondo) resta leggibile
  a qualunque numero di risultati ed è ora la vista di apertura; la Timeline
  resta disponibile come vista secondaria, con un avviso quando i risultati
  filtrati superano la soglia di leggibilità. Aggiunta anche una ricerca
  libera per titolo/ente.

**Correzione dei dati già in produzione scritti prima di questo fix**: le
misure inserite dal primo giro di scan (quando il filtro era ancora troppo
permissivo) restano in tabella con `scadenzaStimata = false` di default e
possono includere voci non pertinenti (news/eventi scambiati per bandi).
Due endpoint di manutenzione una tantum, protetti dallo stesso
`CRON_SECRET` dell'endpoint di seed, sistemano i dati già scritti senza
dover ripetere gli scan:

1. `/api/setup/backfill-scadenza-stimata?secret=...` — marca come "stimata"
   ogni misura automatica la cui finestra è esattamente apertura+1 anno
   (il segnaposto usato quando il parser non trova una data vera).
   Idempotente, va richiamato una volta dopo il deploy di questo fix.
2. `/api/setup/pulisci-misure-non-pertinenti?secret=...` — **anteprima**
   (nessuna scrittura) delle misure automatiche che, con le regole di
   rilevanza attuali, non passerebbero più il filtro e non hanno nessun
   prospect in match. Aggiungere `&esegui=true` per cancellarle davvero,
   solo dopo aver controllato l'anteprima.

Non ancora in questa build (fasi successive, da confermare una alla volta):
le restanti ~40 Camere di Commercio oltre al batch attuale (Fase 4),
pipeline kanban (Fase 5 opzionale). La Fase 3 (frontend pubblico) è
descritta nella sezione sotto.

### Frontend pubblico — Finanza Agevolata Match (Fase 3)

Pagina pubblica, **nessun login** (esclusa volutamente dal matcher di
`middleware.ts`): `/finanza-agevolata-match`. Un'azienda inserisce la
propria Partita IVA + email, il tool:

1. Risolve la Partita IVA in anagrafica azienda (ragione sociale, ATECO,
   regione) tramite **openapi.it** — `src/lib/integrations/openapi-business.ts`.
2. Salva/aggiorna quell'anagrafica come `Prospect` (upsert per `piva`,
   `fonteImport: "Finanza Agevolata Match (pubblico)"`) — il lead entra
   così anche nel CRM interno, il team lo vede tra i Prospect come
   qualunque altro importato da CSV.
3. Ricalcola i match con lo **stesso motore a regole** della dashboard
   (`ricalcolaMatchPerProspect`, zero AI/LLM anche qui) e li mostra subito
   in pagina.
4. Li invia anche via email (Resend) — fail-open: se l'invio fallisce o
   `RESEND_API_KEY` non è configurata, l'utente vede comunque i risultati
   a video, solo senza l'email.

Usa lo **stesso adapter OpenAPI e la stessa cache aziende** del motore di
prospecting automatico (sezione sotto): `IT-advanced/{piva}` — l'unico
endpoint che, per le specifiche fornite dal team, accetta una Partita IVA
come identificativo diretto. Una P.IVA cercata qui e poi ritrovata da una
ricerca automatica su un bando (o viceversa) non genera una seconda
chiamata Advanced a pagamento.

**Mappatura della risposta da verificare contro un caso reale.** Non ho
accesso alla rete pubblica da questo ambiente (stesso limite dei parser di
monitoraggio, vedi sotto), quindi la forma esatta dei campi nella risposta
di Advanced non ha potuto essere testata — `mappaRispostaAdvanced` in
`src/lib/prospecting/advanced-mapper.ts` prova più nomi di campo plausibili
per ogni valore (mai inventa un dato: se non trova nessun percorso valido
per un campo resta `null`), ma se in produzione la ricerca torna con
ragione sociale/ATECO/regione/PEC vuoti nonostante una risposta 200, il
problema è quasi certamente lì — un esempio reale di risposta (anche con
dati anonimizzati) basta a correggere la mappatura in pochi minuti, stesso
procedimento già usato per calibrare i parser delle fonti con HTML reale.

Da notare: un lookup anagrafico da Partita IVA in genere NON include
fatturato/numero dipendenti (serve un prodotto "bilanci" separato, non
detto sia nel piano attivato) — il motore di matching tratta comunque
questi campi mancanti come "da verificare", mai come esclusione (vedi
`valutaMatch` in `src/lib/matching/engine.ts`).

Variabili d'ambiente da impostare (vedi `.env.example`): `OPENAPI_IT_API_KEY`
(obbligatoria — senza, l'endpoint risponde con un errore esplicito, non
inventa dati), `RESEND_API_KEY` + `EMAIL_FROM` (email di riepilogo),
`MOLO_PHONE_NUMBER` + `MOLO_BOOKING_URL` (CTA di contatto mostrata sotto i
risultati, entrambe opzionali).

### Prospecting automatico via OpenAPI — sostituisce il CSV manuale

Su richiesta esplicita del team, in base al documento "Sonar 4.0 —
Specifiche di funzionamento" (2 settembre 2026): invece di caricare a mano
un CSV di prospect, dalla scheda di un bando il team può cercare in
automatico le aziende compatibili con i suoi requisiti strutturati
(ATECO, fatturato, dipendenti) tramite **OpenAPI Company** (`IT-search` +
`IT-advanced`), arricchendo solo le candidate selezionate e riusando una
cache persistente tra bandi diversi — tutto in `src/lib/prospecting/`.

**Come si usa**: sulla scheda di una misura, il pannello "Trova aziende
compatibili (OpenAPI)" mostra il budget residuo e il costo massimo stimato
PRIMA di avviare — il click chiede conferma con quella stima, non parte
mai da solo. Al termine mostra candidate trovate, quante arricchite ora,
quante riusate da cache e quanti match risultanti; la lista "Prospect
idonei" sotto si aggiorna in automatico.

Pezzi principali:

- `openapi-client.ts`: chiamate HTTP a `IT-search`/`IT-advanced` (endpoint
  confermati dalle specifiche del team, non indovinati — diverso
  dall'`IT-start` usato in una versione precedente di questo file, mai
  confermato). La forma esatta dei parametri di Search e dei campi di
  risposta resta comunque da verificare contro l'API reale.
- `query-compiler.ts`: traduce SOLO i requisiti la cui semantica è certa
  (ATECO ammessi, fatturato min/max, dipendenti min/max) in filtri Search.
  Regione/provincia NON viene tradotta — l'esempio delle specifiche usa un
  parametro `province` (codice a 2 lettere), mentre `Misura.regioniAmmesse`
  contiene nomi di regione: senza una mappa regione→province verificata,
  tradurla a monte rischierebbe di escludere aziende ammissibili per un
  parametro sbagliato (esattamente il caso che le specifiche vietano
  esplicitamente, §6). Resta verificata a valle da `valutaMatch` sui dati
  Advanced.
- `budget.ts`: guardrail di spesa — budget giornaliero/mensile
  configurabili (env), **prenotati PRIMA di ogni chiamata** dentro una
  transazione DB (mai speso più del budget, mai un addebito non
  contabilizzato). Nessun lock distribuito vero (Redis o simile non è
  presente in questo progetto) — per un team piccolo su un'unica istanza
  la prenotazione atomica in transazione copre lo stesso rischio pratico;
  se in futuro servissero più istanze concorrenti, va rivisto.
- `cache.ts`: riusa la tabella `Prospect` esistente come cache aziende
  (niente entità `companies` parallela — nel dominio di questo prodotto
  sono lo stesso concetto), con TTL configurabile (`OPENAPI_ADVANCED_TTL_GIORNI`,
  default 90 giorni).
- `engine.ts`: orchestrazione — versione semplificata rispetto allo
  pseudocodice completo delle specifiche (§14): una sola pagina per
  segmento di query (no paginazione persistente multi-pagina ancora), un
  run alla volta senza lock distribuito. Onestamente segnalato in UI
  quando la copertura di un run è parziale.

Verificato con test end-to-end contro il Postgres locale (poi rimossi,
mockando solo la telefonata di rete verso OpenAPI): un primo run arricchisce
davvero solo le candidate nuove e crea i match; un secondo run identico
riusa la cache e non richiama Advanced una seconda volta (zero doppia
spesa); il guardrail di budget rifiuta correttamente la chiamata che
sforerebbe il limite, senza scrivere un addebito fantasma.

### Nota importante sui parser di monitoraggio — serve un giro di calibrazione reale

L'ambiente in cui questa build è stata sviluppata **non ha accesso alla rete
pubblica** (policy di sandboxing) — quindi né gli URL delle 46 fonti né i
selettori CSS dei parser hanno potuto essere verificati contro l'HTML reale
dei siti. È un limite tecnico di questo ambiente, non del motore: il
deploy su Vercel (o qualunque hosting con accesso reale a Internet) ce l'ha,
il motore no.

Cosa è stato fatto per limitare il danno di questo limite:

1. L'estrazione euristica (vedi sopra) non dipende da selettori esatti, solo
   da parole chiave nel testo dei link — funziona ragionevolmente anche su
   siti mai visti.
2. Gli URL delle fonti puntano all'homepage istituzionale quando non è stato
   possibile indovinare con sicurezza il percorso esatto della sezione
   bandi — evita un 404 secco e lascia lavorare l'euristica dal menu
   principale.
3. Ogni scan (riuscito o fallito) è **sempre** loggato in `ScanLog`, visibile
   per fonte nella pagina **Fonti monitorate**, con il messaggio di errore
   esatto (dominio sbagliato, 403, timeout, ecc.).

**Primo passo consigliato dopo il deploy**: dalla dashboard, Fonti
monitorate → "Scansiona tutte ora", poi guardare il riepilogo. Le fonti in
errore da dominio sbagliato (es. un Comune di Commercio che ha cambiato URL
dopo un accorpamento) si correggono aggiornando `url` nel relativo file di
config e ripushando — non serve toccare il motore. Le fonti che rispondono
ma non trovano misure utili vanno quasi sempre migliorate aggiungendo
selettori CSS specifici in `selettoriVoce` (vedi le factory) una volta
ispezionato l'HTML reale della pagina bandi.

### Filtro di rilevanza AI (secondo gate, dopo quello a regole)

Il filtro a parole chiave/regex (`punteggioVoceBando` in
`src/lib/monitoring/parsers/shared.ts`) non può distinguere per
significato: "bando", "avviso", "domande" compaiono anche in notizie,
comitati, eventi che non sono misure di finanza agevolata — ogni nuovo
caso limite segnalato dal team è stato corretto, ma con un motore
puramente a regole su 46 siti eterogenei nuovi casi possono sempre
ricomparire. Per questo `src/lib/monitoring/classificatore.ts` aggiunge
un secondo filtro: ogni voce già passata dal filtro a regole viene
sottoposta a un giudizio di Claude (un lotto per fonte scansionata, non
una chiamata per voce) prima di essere scritta come Misura. Modello
usato: **Claude Haiku 4.5**, il più economico attualmente disponibile
($1/$5 per milione di token in/out) — un compito di classificazione
binaria come questo non richiede un modello di punta. Costo indicativo:
qualche centesimo per uno scan completo delle 46 fonti.

**Da configurare**: serve la variabile d'ambiente `ANTHROPIC_API_KEY`
(Vercel → Settings → Environment Variables) — senza quella il filtro è
disattivato in modo trasparente (fail-open: nessun errore, si passa
solo dal filtro a regole, esattamente come oggi). Anche con la chiave
configurata, qualunque errore della chiamata (rete, timeout, risposta
non interpretabile) fa passare quel lotto invariato invece di bloccare
lo scan: la priorità resta non perdere mai una misura vera per un
problema di questo secondo filtro.

### Correzione URL fonti + bug reale nel reseed (47 fonti)

Il team ha verificato a mano gli URL reali di Invitalia e SIMEST (questo
ambiente di sviluppo non ha accesso alla rete pubblica per farlo da qui —
vedi sopra): quelli usati finora puntavano a pagine istituzionali
generiche senza elenco bandi, non alle sezioni incentivi vere. Corretti,
e aggiunta una seconda fonte Invitalia (il sito ha due sezioni elenco
distinte: "per le imprese" e "per chi vuole fare impresa") — **47 fonti**
totali.

Nel farlo, trovato un bug più a monte: `eseguiSeed` faceva l'upsert delle
fonti con `update: {}` — rilanciare il seed dopo aver corretto un URL nel
codice non aggiornava MAI la riga già esistente in produzione, solo le
fonti nuove. Ogni correzione di URL fatta finora rischiava di non
arrivare mai a chi aveva già girato il seed una volta. Ora l'upsert
aggiorna sempre nome/url/livello/regione dal codice (mai i campi
operativi come `attiva` o lo stato di scansione, quelli restano lavoro
del team) — corretto e verificato con un test che simula esattamente
questo scenario (fonte già esistente con URL vecchio, reseed, URL
aggiornato davvero).

### Arricchimento dalla pagina di dettaglio (`src/lib/monitoring/dettaglio.ts`)

La pagina elenco di una fonte dà solo titolo e poco contesto — importo,
scadenza vera, ATECO, fatturato, dipendenti, documenti richiesti sono
quasi sempre scritti solo nella pagina di **dettaglio** del singolo
bando. Senza questi campi il motore di matching non ha nulla su cui
confrontare i prospect (schede come "Importo non specificato — Scadenza
non nota" su ogni misura). Ora, per ogni misura non ancora arricchita, il
motore visita anche la sua pagina di dettaglio (`linkFonteUfficiale`) e
ne estrae i requisiti — due livelli, corroboranti:

1. Le stesse regex di scadenza/importo usate sulla pagina elenco,
   riapplicate al testo — molto più ricco — della pagina di dettaglio.
   Non richiede AI.
2. Se `ANTHROPIC_API_KEY` è configurata, un'estrazione strutturata più
   ricca (ATECO, fatturato, dipendenti, documenti, descrizione estesa)
   che le regex non possono fare in modo affidabile su HTML così
   eterogeneo — mai valori inventati, solo quello scritto esplicitamente
   nella pagina.

Le misure già arricchite (hanno già una descrizione estesa e almeno un
requisito) non vengono rivisitate ad ogni scan, solo quelle nuove o mai
arricchite — ma questo comunque **allunga sensibilmente la durata di uno
scan** su una fonte con molte voci nuove (una richiesta HTTP in più per
ogni voce, non solo una per fonte). Accettato esplicitamente: meglio uno
scan più lento con dati veri che uno rapido con schede vuote.

### Bug reale trovato e corretto: la ricerca si fermava al primo selettore

`estraiVociListaGenerico` provava i selettori CSS candidati in ordine e
si fermava al **primo** che trovava almeno un risultato, scartando ogni
selettore successivo anche se più specifico e corretto — se un selettore
generico all'inizio dell'elenco intercettava per caso un solo link fuori
tema (es. un "Bando di gara" per forniture d'ufficio, non un incentivo),
la ricerca si fermava lì, perdendo le decine di voci vere che un
selettore più avanti avrebbe trovato. Ora prova **tutti** i selettori e
unisce i risultati. Trovato anche un bug di normalizzazione (gli accenti
non venivano rimossi in modo coerente, quindi "più" non coincideva mai
con "piu" nell'elenco delle frasi generiche da escludere) che faceva
fallire il riconoscimento di CTA molto comuni ("Scopri di più", "Leggi di
più...") — il recupero del titolo vero da un'intestazione vicina ora è
basato sul punteggio di rilevanza invece che su un elenco fisso di frasi,
quindi funziona anche per CTA mai previste in anticipo.

### Il punteggio ora considera anche il contesto della card, non solo il titolo

Trovato analizzando HTML reale mandato dal team (una card Invitalia con
zero misure rilevate nonostante 135 link nella pagina): il titolo di un
incentivo è spesso un **nome proprio della misura** ("Fondo di contrasto
alla deindustrializzazione 2026") senza nessuna delle parole chiave
generiche cercate finora (niente "bando"/"avviso"/"incentivo" nel
titolo) — da solo non avrebbe mai superato la soglia. Il resto della
card però ha segnali fortissimi e specifici ("In apertura", "Data
apertura: 28 settembre 2026", "Data chiusura: ...") che il motore non
guardava. `punteggioVoceBando` ora valuta titolo + contesto della card
insieme (nuovo bonus per le etichette di stato tipiche di un incentivo,
e riconoscimento anche delle date testuali "28 settembre 2026", non solo
di quelle numeriche) — verificato che un altro titolo-nome-proprio senza
questi segnali di contesto (un evento culturale) resti correttamente
escluso, per assicurarsi che il fix sia mirato e non abbia semplicemente
allargato tutto. Aggiornato di conseguenza anche il recupero del titolo
(vedi sopra): con il contesto che ora aiuta il punteggio, anche una CTA
sporca "passa" da sola grazie alla card intorno — il recupero del
titolo vero da un'intestazione non può più dipendere dal punteggio per
decidere se attivarsi, altrimenti non scatterebbe mai.

Questo fix ha subito riportato una delle due fonti Invitalia da 1 a 15
misure trovate. Le altre due fonti rimaste bloccate a 1 (l'altra sezione
Invitalia, "per chi vuole fare impresa", e MIMIT) hanno rivelato — con
altro HTML reale mandato dal team — **due bug diversi**, non risolti dal
fix sopra:

1. **Selettori calibrati comunque bocciati dalla soglia generica.** Una
   card Invitalia reale ("Cultura Cresce") ha un titolo pulito, una
   descrizione breve e nessuna parola chiave/data/etichetta di stato nel
   testo raccolto: pur essendo intercettata da un selettore verificato a
   mano (`.card-unified__title`), il punteggio testuale da solo restava
   sotto soglia. Soluzione: `estraiVociListaGenerico` ora accetta un
   secondo elenco di selettori "calibrati" (verificati contro HTML reale
   del sito), valutati con una soglia molto più permissiva
   (`SOGLIA_VOCE_BANDO_CALIBRATA`, vedi shared.ts) — qui non serve dedurre
   dal testo che sia una card di incentivo, lo garantisce già la
   struttura del sito. Restano validi il veto assoluto sulle frasi
   generiche e la penalità sulle parole escluse/link non-pagina, quindi
   una "Privacy Policy" intercettata per errore da un selettore troppo
   ampio continua a essere scartata.
2. **Il contesto letto era identico al solo titolo, su siti con wrapper
   generici.** Su mimit.gov.it il link di ogni misura sta in un `<h2>`,
   ma la descrizione e la data stanno in un `<p>` **fratello**
   dell'`<h2>`, non al suo interno — e il sito non usa nessuna delle
   classi/tag tipici di card (`li`, `article`, `.card`, `.item`...) su
   cui si basava la ricerca del contenitore. Il contesto raccolto era
   quindi identico al solo testo del titolo, la card non aveva mai i
   segnali che il punteggio richiede pur essendo un incentivo vero.
   Soluzione: nuova `trovaContenitoreVoce` in shared.ts, che quando non
   trova nessuno dei tag/classi noti risale i genitori (fino a un tetto
   di livelli e di caratteri, per non finire per sbaglio su un
   contenitore con più card mischiate insieme) finché il testo non
   cresce in modo sostanziale rispetto al solo link.

Corretti anche, nello stesso giro: `PERCORSO_BANDO` non riconosceva
`/incentivi-e-strumenti/` (Invitalia) perché richiedeva il segmento di URL
esatto `/incentivi/`; il selettore MIMIT aveva un refuso singolare/plurale
(`/incentivo` invece di `/incentivi/`) che non intercettava mai nessun
link reale. Verificato con un test sintetico basato sull'HTML reale di
entrambi i siti (comprese due card Invitalia aggiuntive con titolo pulito
e zero segnali testuali, per riprodurre esattamente il caso che sfuggiva),
più un negative control (link di navigazione/privacy/cookie nello stesso
contenitore "largo") per assicurarsi che il fix non abbia semplicemente
allargato la maglia del filtro.

## Stack

Next.js 14 (App Router) · TypeScript · Prisma + PostgreSQL · NextAuth
(credentials) · Tailwind CSS · vis-timeline · papaparse · cheerio ·
Claude API (filtro di rilevanza fonti, opzionale — vedi sopra) ·
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
