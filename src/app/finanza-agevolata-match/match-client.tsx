"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import Image from "next/image";
import { CATEGORIA_LABEL } from "@/lib/misure/valore";

/* -------------------------------------------------------------------------
 * "Scopri i tuoi incentivi" — landing pubblica MOLO 4.0, lead magnet sulla
 * finanza agevolata. Indipendente dal design system interno di Sonar 4.0
 * (nessun componente da src/components/ui, nessun token condiviso tra i
 * due — né "brand", né "danger"). Palette dal design system reale del
 * sito pubblico MOLO:
 * rosso CTA #FF2D16, inchiostro #2B2E34, blu #198FD9, verde #65BD7D, ocra
 * #E4A858 — e la metafora di marca dichiarata nel documento di estrazione:
 * "la navigazione marittima come metafora dello sviluppo d'impresa:
 * bussola, timone, imbarcazioni di carta... Il marchio rosso funziona
 * anche come grande elemento decorativo parzialmente tagliato ai bordi
 * delle sezioni." Qui quella metafora è reinterpretata da zero — una
 * bussola che cerca il nord, una rotta tratteggiata, una barchetta di
 * carta che la percorre — non è una copia delle illustrazioni raster del
 * sito attuale, che il team ha esplicitamente chiesto di non replicare.
 *
 * Font: Poppins (corpo, invariato — è il font reale del sito MOLO) più
 * Bricolage Grotesque per titoli e numeri in grande, caricato solo su
 * questa pagina via @import scoped, per un contrasto di scala molto più
 * marcato di quanto Poppins da solo permetta.
 *
 * Flusso in quattro passi, invariato nella logica (vedi le due API in
 * src/app/api/pubblico/match/): form → scansione → teaser (email gate) →
 * risultato. Qui è stato ridisegnato solo lo strato visivo.
 * ------------------------------------------------------------------------- */

interface DatiAzienda {
  ragioneSociale: string;
  ateco: string | null;
  regione: string | null;
  provincia: string | null;
  fatturato: number | null;
  numeroDipendenti: number | null;
}

interface Contatti {
  telefono: string | null;
  bookingUrl: string | null;
}

interface MisuraRisultato {
  id: string;
  titolo: string;
  ente: string;
  categoria: string;
  descrizioneBreve: string;
  valoreFormattato: string;
  scadenzaFormattata: string;
  scadenzaStimata: boolean;
  linkFonteUfficiale: string;
}

type Stato =
  | { fase: "form" }
  | { fase: "scansione"; piva: string }
  | { fase: "teaser"; piva: string; azienda: DatiAzienda; numeroMisureTrovate: number; contatti: Contatti }
  | { fase: "risultato"; azienda: DatiAzienda; misure: MisuraRisultato[]; emailInviata: boolean; contatti: Contatti }
  | { fase: "errore"; messaggio: string };

const PASSI_SCANSIONE = [
  "Verifica della Partita IVA…",
  "Recupero dei dati camerali…",
  "Confronto con i bandi attivi e in arrivo…",
  "Calcolo delle agevolazioni compatibili…",
];

const euroFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("it-IT");

function formattaPiva(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

/* ------------------------------ Reveal on scroll --------------------------- */

function useInView<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisto(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visto];
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, visto] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`molo-reveal ${visto ? "molo-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------------------------- App ------------------------------------ */

export function MatchClient() {
  const [stato, setStato] = useState<Stato>({ fase: "form" });
  const [piva, setPiva] = useState("");
  const [email, setEmail] = useState("");
  const [consenso, setConsenso] = useState(false);
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [erroreEmail, setErroreEmail] = useState<string | null>(null);

  function reset() {
    setStato({ fase: "form" });
    setPiva("");
    setEmail("");
    setConsenso(false);
    setErroreEmail(null);
  }

  async function handleScansione(e: FormEvent) {
    e.preventDefault();
    if (piva.length !== 11) return;
    setStato({ fase: "scansione", piva });
    try {
      const res = await fetch("/api/pubblico/match/scansione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piva }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStato({ fase: "errore", messaggio: json.errore ?? "Qualcosa non ha funzionato. Riprova." });
        return;
      }
      setStato({ fase: "teaser", piva, azienda: json.azienda, numeroMisureTrovate: json.numeroMisureTrovate, contatti: json.contatti });
    } catch {
      setStato({ fase: "errore", messaggio: "Non riusciamo a contattare il server. Controlla la connessione e riprova." });
    }
  }

  async function handleSblocca(e: FormEvent) {
    e.preventDefault();
    if (stato.fase !== "teaser" || !consenso) return;
    setInviandoEmail(true);
    setErroreEmail(null);
    try {
      const res = await fetch("/api/pubblico/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piva: stato.piva, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroreEmail(json.errore ?? "Qualcosa non ha funzionato. Riprova.");
        setInviandoEmail(false);
        return;
      }
      setStato({ fase: "risultato", azienda: json.azienda, misure: json.misure, emailInviata: json.emailInviata, contatti: json.contatti });
    } catch {
      setErroreEmail("Non riusciamo a contattare il server. Controlla la connessione e riprova.");
    } finally {
      setInviandoEmail(false);
    }
  }

  const fasiConHero = stato.fase !== "risultato";

  return (
    <div className="molo-landing min-h-screen bg-white text-[#2B2E34]">
      <GranaOverlay />
      <IntestazioneMinima contatti={stato.fase === "teaser" || stato.fase === "risultato" ? stato.contatti : null} />

      {fasiConHero && (
        <HeroInterattivo
          stato={stato}
          piva={piva}
          setPiva={setPiva}
          email={email}
          setEmail={setEmail}
          consenso={consenso}
          setConsenso={setConsenso}
          inviandoEmail={inviandoEmail}
          erroreEmail={erroreEmail}
          onScansiona={handleScansione}
          onSblocca={handleSblocca}
          onReset={reset}
        />
      )}

      {stato.fase === "form" && (
        <>
          <ComeFunziona />
          <SezioneTrigger />
          <Marquee />
        </>
      )}

      {stato.fase === "risultato" && <RisultatoSezione stato={stato} onReset={reset} />}

      <FooterLanding />

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap");

        .molo-landing {
          --molo-display: "Bricolage Grotesque", "Poppins", sans-serif;
        }
        .molo-display {
          font-family: var(--molo-display);
        }

        @keyframes molo-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes molo-ring {
          0% {
            transform: scale(0.75);
            opacity: 0.55;
          }
          100% {
            transform: scale(2.1);
            opacity: 0;
          }
        }
        @keyframes molo-seek {
          0%,
          100% {
            transform: rotate(-14deg);
          }
          22% {
            transform: rotate(11deg);
          }
          48% {
            transform: rotate(-7deg);
          }
          74% {
            transform: rotate(16deg);
          }
        }
        @keyframes molo-twinkle {
          0%,
          100% {
            opacity: 0.15;
            transform: scale(0.7);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }
        @keyframes molo-dash {
          to {
            stroke-dashoffset: -200;
          }
        }
        @keyframes molo-marquee {
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes molo-word-in {
          from {
            opacity: 0;
            transform: translateY(0.35em) rotateX(35deg);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotateX(0);
            filter: blur(0);
          }
        }
        @keyframes molo-glow-pulse {
          0%,
          100% {
            box-shadow: 0 10px 30px -8px rgba(255, 45, 22, 0.55);
          }
          50% {
            box-shadow: 0 14px 46px -6px rgba(255, 45, 22, 0.85);
          }
        }
        @keyframes molo-bob {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .molo-spin {
          animation: molo-spin 5s linear infinite;
        }
        .molo-ring {
          animation: molo-ring 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .molo-seek {
          transform-origin: 50% 50%;
          animation: molo-seek 6.5s ease-in-out infinite;
        }
        .molo-twinkle {
          animation: molo-twinkle 2.6s ease-in-out infinite;
        }
        .molo-route {
          stroke-dasharray: 4 9;
          animation: molo-dash 6s linear infinite;
        }
        .molo-marquee-track {
          animation: molo-marquee 22s linear infinite;
        }
        .molo-word {
          display: inline-block;
          animation: molo-word-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .molo-glow-btn {
          animation: molo-glow-pulse 2.4s ease-in-out infinite;
        }
        .molo-bob {
          animation: molo-bob 3.4s ease-in-out infinite;
        }

        .molo-reveal {
          opacity: 0;
          transform: translateY(28px) scale(0.97);
          filter: blur(6px);
          transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.8s;
        }
        .molo-reveal.molo-in {
          opacity: 1;
          transform: none;
          filter: blur(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .molo-landing *,
          .molo-landing *::before,
          .molo-landing *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------ Grana / texture ----------------------------- */

function GranaOverlay() {
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full opacity-[0.035] mix-blend-overlay">
      <filter id="molo-grana">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#molo-grana)" />
    </svg>
  );
}

/* ---------------------------- Intestazione ---------------------------- */

function IntestazioneMinima({ contatti }: { contatti: Contatti | null }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur">
        <Image src="/molo-logo.png" alt="MOLO 4.0" width={300} height={89} className="h-6 w-auto sm:h-7" priority />
      </div>
      {contatti?.telefono && (
        <a
          href={`tel:${contatti.telefono}`}
          className="hidden items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/20 sm:inline-flex"
        >
          <PhoneIcon className="h-3.5 w-3.5" />
          {contatti.telefono}
        </a>
      )}
    </header>
  );
}

/* ------------------------------- Hero ---------------------------------- */

function HeroInterattivo(props: {
  stato: Stato;
  piva: string;
  setPiva: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  consenso: boolean;
  setConsenso: (v: boolean) => void;
  inviandoEmail: boolean;
  erroreEmail: string | null;
  onScansiona: (e: FormEvent) => void;
  onSblocca: (e: FormEvent) => void;
  onReset: () => void;
}) {
  const { stato } = props;
  const heroRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 50, y: 30 });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  }

  return (
    <div
      ref={heroRef}
      onMouseMove={onMouseMove}
      className="relative flex min-h-dvh flex-col overflow-hidden bg-[#050910] px-4 pb-10 pt-24 sm:pt-28 lg:pt-24"
    >
      {/* Sfondo: bagliori "oceano notturno" in blu e rosso MOLO + uno
          spotlight che segue il cursore + il marchio a raggiera enorme e
          tagliato ai bordi, come nel linguaggio decorativo del sito reale
          ("il marchio rosso funziona anche come grande elemento
          decorativo parzialmente tagliato ai bordi delle sezioni") — qui
          portato a un'altra scala, per un impatto molto più netto. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-70 transition-[background] duration-300"
          style={{ background: `radial-gradient(600px circle at ${spot.x}% ${spot.y}%, rgba(25,143,217,0.16), transparent 70%)` }}
        />
        <Image
          src="/molo-mark.png"
          alt=""
          width={244}
          height={260}
          className="molo-seek absolute -left-[7rem] -top-[5rem] h-[24rem] w-auto opacity-[0.09] sm:-left-[14rem] sm:-top-[10rem] sm:h-[46rem] sm:opacity-[0.12] lg:-left-[18rem] lg:h-[58rem]"
        />
        <div className="absolute -bottom-40 -right-24 h-[36rem] w-[36rem] animate-float rounded-full bg-[#FF2D16]/20 blur-[130px]" style={{ animationDelay: "-7s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-6 xl:max-w-[88rem] 2xl:max-w-[104rem]">
        {stato.fase === "form" ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 xl:gap-16">
            <div>
              <ContenutoHeroTestuale />
              <div className="mt-6 lg:hidden">
                <SceneBussola />
              </div>
              <div className="mt-6">
                <CardScura>
                  <FormPivaView piva={props.piva} setPiva={props.setPiva} onSubmit={props.onScansiona} />
                </CardScura>
              </div>
            </div>
            <div className="hidden lg:block">
              <SceneBussola />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl">
            {stato.fase === "scansione" && (
              <CardScura>
                <ScansioneView />
              </CardScura>
            )}
            {stato.fase === "teaser" && (
              <CardScura>
                <TeaserView
                  stato={stato}
                  email={props.email}
                  setEmail={props.setEmail}
                  consenso={props.consenso}
                  setConsenso={props.setConsenso}
                  inviando={props.inviandoEmail}
                  errore={props.erroreEmail}
                  onSubmit={props.onSblocca}
                />
              </CardScura>
            )}
            {stato.fase === "errore" && (
              <CardScura>
                <ErroreView messaggio={stato.messaggio} onReset={props.onReset} />
              </CardScura>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContenutoHeroTestuale() {
  const parole = ["La", "tua", "azienda", "ha", "diritto", "a", "un", "incentivo?"];
  return (
    <div style={{ perspective: "600px" }}>
      <span className="molo-word inline-flex items-center gap-2 rounded-full bg-[#FF2D16]/15 px-3 py-1 text-[clamp(11px,0.6vw+9px,13px)] font-bold uppercase tracking-wider text-[#FF6A56] ring-1 ring-[#FF2D16]/30">
        Finanza agevolata · verifica gratuita
      </span>
      <h1 className="mt-3.5 text-[clamp(1.875rem,1.3rem+1.7vw,3.125rem)] font-extrabold leading-[1.08] tracking-tight text-white">
        {parole.map((p, i) => (
          <span key={p} className="molo-word mr-[0.28em]" style={{ animationDelay: `${0.06 + i * 0.05}s` }}>
            {p}
          </span>
        ))}
        <span
          className="molo-word molo-display block bg-gradient-to-r from-[#FF6A56] via-[#FF2D16] to-[#ff7a3d] bg-clip-text italic leading-[1.1] tracking-tight text-transparent"
          style={{ animationDelay: "0.55s" }}
        >
          Scoprilo in 60&nbsp;secondi.
        </span>
      </h1>
      <p
        className="molo-word mt-3.5 max-w-md text-[14px] leading-relaxed text-white/60 sm:text-[15px] lg:max-w-lg xl:max-w-xl"
        style={{ animationDelay: "0.75s" }}
      >
        Inserisci la Partita IVA: la confrontiamo con tutti i bandi e gli incentivi attivi o in arrivo, monitorati
        ogni giorno da fonti ufficiali. Gratis, senza impegno.
      </p>
    </div>
  );
}

/* --------------------------- Scena "la rotta" -------------------------------
 * Motion graphic originale ispirato alla metafora di navigazione del
 * brand: una bussola che cerca il nord (oscillazione elastica, non una
 * rotazione piatta), una rotta tratteggiata che scorre, una barchetta di
 * carta che la percorre in loop tramite <animateMotion>/<mpath> — nessuna
 * libreria esterna, solo SVG nativo + CSS. */
function SceneBussola() {
  return (
    <div className="molo-bob relative mx-auto aspect-square w-full max-w-[15rem] sm:max-w-xs lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
      <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Bussola che indica la rotta verso i tuoi incentivi">
        <defs>
          <radialGradient id="glowNord" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#198FD9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#198FD9" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="200" cy="200" r="150" fill="url(#glowNord)" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="112" fill="none" stroke="rgba(25,143,217,0.3)" strokeWidth="1" strokeDasharray="2 6" />

        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1="200"
            y1="52"
            x2="200"
            y2={i % 3 === 0 ? "68" : "62"}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={i % 3 === 0 ? 2 : 1}
            transform={`rotate(${i * 30} 200 200)`}
          />
        ))}

        {/* rotta tratteggiata dalla bussola verso l'obiettivo, in alto a destra */}
        <path id="rottaIncentivi" d="M 165 235 C 120 300, 250 330, 320 235 S 300 90, 330 78" fill="none" stroke="#FF6A56" strokeWidth="2.5" strokeLinecap="round" className="molo-route" opacity="0.85" />

        {/* scintille lungo la rotta */}
        <circle cx="205" cy="300" r="3" fill="#65BD7D" className="molo-twinkle" style={{ animationDelay: "0.2s" }} />
        <circle cx="300" cy="255" r="2.5" fill="#E4A858" className="molo-twinkle" style={{ animationDelay: "1s" }} />
        <circle cx="320" cy="150" r="2.5" fill="#198FD9" className="molo-twinkle" style={{ animationDelay: "1.7s" }} />

        {/* traguardo */}
        <circle cx="330" cy="78" r="7" fill="none" stroke="#FF2D16" strokeWidth="2" className="molo-ring" style={{ transformOrigin: "330px 78px" }} />
        <circle cx="330" cy="78" r="4.5" fill="#FF2D16" />

        {/* barchetta di carta che percorre la rotta */}
        <g>
          <path d="M -9 4 L 9 4 L 5 10 L -5 10 Z M 0 -10 L 0 4 M 0 -10 L 8 2 L 0 4 Z" fill="#ffffff" stroke="#2B2E34" strokeWidth="1" strokeLinejoin="round">
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
              <mpath href="#rottaIncentivi" />
            </animateMotion>
          </path>
        </g>

        {/* ago della bussola: cerca il nord con un'oscillazione elastica */}
        <g className="molo-seek" style={{ transformOrigin: "200px 200px" }}>
          <path d="M200 152 L214 200 L200 248 L186 200 Z" fill="#FF2D16" />
          <path d="M200 152 L214 200 L200 200 Z" fill="#ff8f7f" />
          <circle cx="200" cy="200" r="9" fill="#2B2E34" />
          <circle cx="200" cy="200" r="4" fill="#ffffff" />
        </g>
      </svg>

      <span className="absolute right-2 top-6 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#2B2E34] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#65BD7D]" /> I tuoi incentivi
      </span>
    </div>
  );
}

function CardScura({ children }: { children: React.ReactNode }) {
  return (
    <div className="molo-reveal molo-in rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] sm:p-7">{children}</div>
  );
}

/* -------------------------------- Form ---------------------------------- */

function FormPivaView({ piva, setPiva, onSubmit }: { piva: string; setPiva: (v: string) => void; onSubmit: (e: FormEvent) => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  function onMagnetMove(e: React.MouseEvent<HTMLButtonElement>) {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left - r.width / 2) * 0.25;
    const y = (e.clientY - r.top - r.height / 2) * 0.35;
    btnRef.current!.style.transform = `translate(${x}px, ${y}px)`;
  }
  function onMagnetLeave() {
    if (btnRef.current) btnRef.current.style.transform = "translate(0,0)";
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="piva" className="mb-1.5 block text-[13px] font-semibold text-[#2B2E34]/70">
        Partita IVA della tua azienda
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          id="piva"
          inputMode="numeric"
          required
          value={piva}
          onChange={(e) => setPiva(formattaPiva(e.target.value))}
          placeholder="12345678901"
          minLength={11}
          maxLength={11}
          className="h-[3.25rem] flex-1 rounded-2xl border-2 border-[#2B2E34]/10 bg-[#F9F9FB] px-5 text-[17px] font-semibold tracking-wide text-[#2B2E34] outline-none transition-colors placeholder:text-[#2B2E34]/25 focus:border-[#198FD9] focus:bg-white"
        />
        <button
          ref={btnRef}
          type="submit"
          onMouseMove={onMagnetMove}
          onMouseLeave={onMagnetLeave}
          disabled={piva.length !== 11}
          className="molo-glow-btn group inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#FF2D16] px-7 text-[16px] font-bold text-white transition-[transform,background-color,box-shadow] duration-200 hover:bg-[#e0210d] active:scale-[0.97] disabled:cursor-not-allowed disabled:animate-none disabled:opacity-40 disabled:shadow-none"
        >
          Scansiona ora
          <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      <p className="mt-2.5 text-[12.5px] text-[#2B2E34]/40">11 cifre, senza spazi né il prefisso IT. La verifica è gratuita e non comporta alcun impegno.</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#2B2E34]/[0.06] pt-3.5 text-[12px] font-medium text-[#2B2E34]/50">
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-[#65BD7D]" /> Nessun impegno
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-[#65BD7D]" /> Risultato in meno di un minuto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-[#65BD7D]" /> Fonti ufficiali aggiornate ogni giorno
        </span>
      </div>
    </form>
  );
}

/* ----------------------------- Scansione --------------------------------- */

function ScansioneView() {
  const [progresso, setProgresso] = useState(4);
  const [indicePasso, setIndicePasso] = useState(0);
  const timerProgresso = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPasso = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerProgresso.current = setInterval(() => {
      setProgresso((p) => {
        if (p >= 92) return p;
        const passo = p < 40 ? 6 : p < 70 ? 3 : 1;
        return Math.min(92, p + passo);
      });
    }, 220);
    timerPasso.current = setInterval(() => {
      setIndicePasso((i) => Math.min(PASSI_SCANSIONE.length - 1, i + 1));
    }, 1100);
    return () => {
      if (timerProgresso.current) clearInterval(timerProgresso.current);
      if (timerPasso.current) clearInterval(timerPasso.current);
    };
  }, []);

  const raggio = 54;
  const circonferenza = 2 * Math.PI * raggio;
  const offset = circonferenza * (1 - progresso / 100);

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <span className="molo-ring absolute inset-0 rounded-full bg-[#FF2D16]/15" />
        <span className="molo-ring absolute inset-0 rounded-full bg-[#198FD9]/15" style={{ animationDelay: "-1.1s" }} />
        <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={raggio} fill="none" stroke="#2B2E34" strokeOpacity="0.08" strokeWidth="7" />
          <circle
            cx="60"
            cy="60"
            r={raggio}
            fill="none"
            stroke="url(#gradAnello)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circonferenza}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.25s ease-out" }}
          />
          <defs>
            <linearGradient id="gradAnello" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#198FD9" />
              <stop offset="100%" stopColor="#FF2D16" />
            </linearGradient>
          </defs>
        </svg>
        <div className="relative flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full bg-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)]">
          <Image src="/molo-mark.png" alt="" width={244} height={260} className="molo-spin h-9 w-auto" />
        </div>
      </div>

      <p className="molo-display mt-6 text-5xl font-extrabold tabular-nums text-[#2B2E34]">{progresso}%</p>
      <p className="mt-1.5 min-h-[20px] text-[14px] font-medium text-[#2B2E34]/55">{PASSI_SCANSIONE[indicePasso]}</p>
    </div>
  );
}

/* ------------------------------- Teaser ---------------------------------- */

function TeaserView({
  stato,
  email,
  setEmail,
  consenso,
  setConsenso,
  inviando,
  errore,
  onSubmit,
}: {
  stato: Extract<Stato, { fase: "teaser" }>;
  email: string;
  setEmail: (v: string) => void;
  consenso: boolean;
  setConsenso: (v: boolean) => void;
  inviando: boolean;
  errore: string | null;
  onSubmit: (e: FormEvent) => void;
}) {
  const { azienda, numeroMisureTrovate } = stato;
  const trovate = numeroMisureTrovate > 0;

  return (
    <div>
      <div className="rounded-2xl bg-[#F9F9FB] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#2B2E34]/40">Azienda analizzata</p>
        <p className="mt-0.5 text-[17px] font-bold text-[#2B2E34]">{azienda.ragioneSociale}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {azienda.ateco && <ChipInfo>ATECO {azienda.ateco}</ChipInfo>}
          {azienda.regione && <ChipInfo>{[azienda.regione, azienda.provincia].filter(Boolean).join(" · ")}</ChipInfo>}
          {azienda.numeroDipendenti != null && <ChipInfo>{numFmt.format(azienda.numeroDipendenti)} dipendenti</ChipInfo>}
          {azienda.fatturato != null && <ChipInfo>{euroFmt.format(azienda.fatturato)} fatturato</ChipInfo>}
        </div>
      </div>

      <div className="mt-5 text-center">
        {trovate ? (
          <>
            <p className="molo-display text-6xl font-extrabold tabular-nums text-[#2B2E34]">{numeroMisureTrovate}</p>
            <p className="mt-1 text-[15px] font-semibold text-[#2B2E34]/70">
              {numeroMisureTrovate === 1 ? "agevolazione compatibile trovata" : "agevolazioni compatibili trovate"}
            </p>
          </>
        ) : (
          <p className="text-[15px] font-semibold text-[#2B2E34]/70">
            Nessuna agevolazione compatibile trovata al momento — te lo faremo sapere appena ne troviamo una.
          </p>
        )}
      </div>

      {trovate && (
        <div className="relative mt-4 overflow-hidden rounded-2xl">
          <div className="space-y-2.5 blur-sm">
            {Array.from({ length: Math.min(3, numeroMisureTrovate) }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#2B2E34]/[0.06] bg-[#F9F9FB] p-4">
                <div className="h-3 w-1/3 rounded bg-[#2B2E34]/10" />
                <div className="mt-2.5 h-4 w-4/5 rounded bg-[#2B2E34]/15" />
                <div className="mt-2 h-3 w-2/3 rounded bg-[#2B2E34]/10" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white via-white/70 to-transparent">
            <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#2B2E34] px-3.5 py-1.5 text-[12px] font-semibold text-white">
              <LockIcon className="h-3 w-3" /> Inserisci la tua email per sbloccarle
            </span>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-5 border-t border-[#2B2E34]/[0.06] pt-5">
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#2B2E34]/70">
          {trovate ? "La tua email, per ricevere l'elenco completo" : "La tua email, per essere avvisato"}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@azienda.it"
          className="h-14 w-full rounded-2xl border-2 border-[#2B2E34]/10 bg-[#F9F9FB] px-5 text-[15px] font-medium text-[#2B2E34] outline-none transition-colors placeholder:text-[#2B2E34]/25 focus:border-[#198FD9] focus:bg-white"
        />
        <label className="mt-3.5 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#2B2E34]/55">
          <input
            type="checkbox"
            required
            checked={consenso}
            onChange={(e) => setConsenso(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#2B2E34]/20 text-[#FF2D16] focus:ring-[#FF2D16]/30"
          />
          <span>
            Acconsento al trattamento dei miei dati da parte di MOLO 4.0 per ricevere l&apos;elenco degli incentivi
            compatibili e, se lo desidero, essere ricontattato.
          </span>
        </label>

        {errore && <p className="mt-3 text-[13px] font-medium text-[#FF2D16]">{errore}</p>}

        <button
          type="submit"
          disabled={!consenso || inviando}
          className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF2D16] text-[16px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,45,22,0.55)] transition-all duration-200 hover:bg-[#e0210d] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {inviando ? "Un attimo…" : trovate ? "Sblocca l'elenco completo" : "Avvisami quando ne trovate una"}
        </button>
      </form>
    </div>
  );
}

function ChipInfo({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-[#2B2E34]/65 ring-1 ring-[#2B2E34]/[0.08]">{children}</span>;
}

/* ------------------------------- Errore ----------------------------------- */

function ErroreView({ messaggio, onReset }: { messaggio: string; onReset: () => void }) {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2D16]/10 text-[#FF2D16]">
        <AlertIcon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-[17px] font-bold text-[#2B2E34]">Non siamo riusciti a completare la verifica</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-[#2B2E34]/55">{messaggio}</p>
      <button
        onClick={onReset}
        className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-[#2B2E34] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#2B2E34]/85"
      >
        Riprova
      </button>
    </div>
  );
}

/* ---------------------------- Risultato finale ----------------------------- */

function RisultatoSezione({ stato, onReset }: { stato: Extract<Stato, { fase: "risultato" }>; onReset: () => void }) {
  const { azienda, misure, emailInviata, contatti } = stato;

  return (
    <div className="bg-[#050910] pb-16 pt-28 sm:pb-24 sm:pt-36">
      <div className="mx-auto max-w-4xl px-4 xl:max-w-5xl">
        <div className="molo-reveal molo-in rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#2B2E34]/40">Risultato per</p>
          <p className="molo-display mt-0.5 text-3xl font-extrabold text-[#2B2E34]">{azienda.ragioneSociale}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {azienda.ateco && <ChipInfo>ATECO {azienda.ateco}</ChipInfo>}
            {azienda.regione && <ChipInfo>{[azienda.regione, azienda.provincia].filter(Boolean).join(" · ")}</ChipInfo>}
            {azienda.numeroDipendenti != null && <ChipInfo>{numFmt.format(azienda.numeroDipendenti)} dipendenti</ChipInfo>}
          </div>
          {emailInviata && (
            <p className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#65BD7D]">
              <CheckIcon className="h-4 w-4" /> Ti abbiamo anche mandato questo elenco via email.
            </p>
          )}
        </div>

        {misure.length === 0 ? (
          <div className="mt-4 rounded-[28px] bg-white p-8 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]">
            <p className="text-[17px] font-bold text-[#2B2E34]">Nessuna misura compatibile al momento</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-[#2B2E34]/55">
              In base ai dati disponibili non risultano bandi o incentivi attivi compatibili con la tua azienda in
              questo momento. Aggiorniamo il monitoraggio ogni giorno: ti avviseremo via email non appena ne
              troveremo uno, oppure contattaci direttamente.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="px-1 text-[13px] font-bold uppercase tracking-wide text-white/50">
              {misure.length === 1 ? "1 agevolazione compatibile" : `${misure.length} agevolazioni compatibili`}
            </p>
            {misure.map((m, i) => (
              <Reveal key={m.id} delay={i * 70}>
                <MisuraCardRisultato misura={m} />
              </Reveal>
            ))}
          </div>
        )}

        <ContattoCTA contatti={contatti} />

        <button onClick={onReset} className="mx-auto mt-6 block text-[13px] font-semibold text-white/40 hover:text-white/70">
          ← Verifica un&apos;altra Partita IVA
        </button>
      </div>
    </div>
  );
}

const ACCENTO_CATEGORIA: Record<string, string> = {
  NAZIONALE: "#198FD9",
  REGIONALE: "#65BD7D",
  CAMERALE: "#E4A858",
  FISCALE: "#FF2D16",
};

function MisuraCardRisultato({ misura }: { misura: MisuraRisultato }) {
  const accento = ACCENTO_CATEGORIA[misura.categoria] ?? "#2B2E34";
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.35)] sm:p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accento }} />
      <div className="pl-2.5">
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${accento}1A`, color: accento }}>
          {CATEGORIA_LABEL[misura.categoria] ?? misura.categoria}
        </span>
        <p className="mt-2.5 text-[17px] font-bold leading-snug text-[#2B2E34]">{misura.titolo}</p>
        <p className="mt-0.5 text-[13px] text-[#2B2E34]/45">{misura.ente}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#2B2E34]/65">{misura.descrizioneBreve}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2B2E34]/[0.06] pt-3.5">
          <div>
            <span className="block text-[17px] font-extrabold text-[#2B2E34]">{misura.valoreFormattato}</span>
            <span className="text-[12.5px] text-[#2B2E34]/40">
              {misura.scadenzaStimata ? "Scadenza da verificare" : `Scadenza ${misura.scadenzaFormattata}`}
            </span>
          </div>
          <a
            href={misura.linkFonteUfficiale}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[#198FD9] hover:text-[#12699e]"
          >
            Fonte ufficiale <ArrowIcon className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ContattoCTA({ contatti }: { contatti: Contatti }) {
  const [calendarioAperto, setCalendarioAperto] = useState(false);
  if (!contatti.telefono && !contatti.bookingUrl) return null;

  return (
    <div className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]">
      <div className="bg-[#2B2E34] p-6 text-center text-white sm:p-8">
        <p className="molo-display text-2xl font-bold">Vuoi una mano a capire quali richiedere davvero?</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] text-white/55">
          Il team MOLO 4.0 verifica con te i requisiti reali e ti aiuta a preparare la domanda, senza impegno.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {contatti.bookingUrl && (
            <button
              onClick={() => setCalendarioAperto((v) => !v)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#FF2D16] px-6 text-[14px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,45,22,0.55)] transition-all hover:bg-[#e0210d] active:scale-[0.97]"
            >
              {calendarioAperto ? "Nascondi calendario" : "Prenota una consulenza gratuita"}
            </button>
          )}
          {contatti.telefono && (
            <a
              href={`tel:${contatti.telefono}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 text-[14px] font-bold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/20"
            >
              <PhoneIcon className="h-4 w-4" /> Chiama {contatti.telefono}
            </a>
          )}
        </div>
      </div>

      {contatti.bookingUrl && calendarioAperto && (
        <div className="animate-fade-in p-3 sm:p-4">
          <iframe src={contatti.bookingUrl} title="Prenota una consulenza gratuita" className="h-[640px] w-full rounded-2xl border border-[#2B2E34]/[0.08]" />
          <a
            href={contatti.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-center text-[12.5px] font-medium text-[#2B2E34]/40 hover:text-[#2B2E34]/70"
          >
            Il calendario non si vede bene? Aprilo in una nuova scheda ↗
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Marketing --------------------------------- */

const COLORI_PASSO = ["#FF2D16", "#198FD9", "#65BD7D"];

function ComeFunziona() {
  const passi = [
    { n: "1", titolo: "Inserisci la Partita IVA", testo: "Recuperiamo automaticamente i dati camerali della tua azienda: nessun modulo da compilare a mano." },
    { n: "2", titolo: "Analizziamo la compatibilità", testo: "Confrontiamo il tuo profilo — settore, regione, dimensione — con i bandi attivi e in arrivo." },
    { n: "3", titolo: "Ricevi i risultati", testo: "Sul sito e via email, con i link alle fonti ufficiali e i prossimi passi per richiederli." },
  ];
  return (
    <section className="bg-white px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
        <Reveal>
          <p className="text-center text-[13px] font-bold uppercase tracking-wider text-[#FF2D16]">Come funziona</p>
          <h2 className="molo-display mt-2 text-center text-[clamp(1.875rem,1.4rem+1.4vw,3rem)] font-bold text-[#2B2E34]">
            Dalla Partita IVA ai bandi giusti, in tre passaggi
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 xl:gap-10">
          {passi.map((p, i) => (
            <Reveal key={p.n} delay={i * 120}>
              <div className="relative h-full overflow-hidden rounded-3xl border border-[#2B2E34]/[0.06] bg-[#F9F9FB] p-6 transition-transform duration-300 hover:-translate-y-1.5">
                <span
                  className="molo-display flex h-11 w-11 items-center justify-center rounded-2xl text-[18px] font-extrabold text-white"
                  style={{ backgroundColor: COLORI_PASSO[i] }}
                >
                  {p.n}
                </span>
                <p className="mt-4 text-[16px] font-bold text-[#2B2E34]">{p.titolo}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#2B2E34]/55">{p.testo}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SezioneTrigger() {
  return (
    <section className="relative overflow-hidden bg-[#0E1420] px-4 py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
        <Image src="/molo-mark.png" alt="" width={244} height={260} className="molo-seek h-[30rem] w-auto" />
      </div>
      <Reveal className="relative mx-auto max-w-2xl text-center xl:max-w-3xl">
        <h2 className="molo-display text-[clamp(1.875rem,1.4rem+1.4vw,3rem)] font-bold leading-tight text-white">Hai un investimento in programma?</h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/55">
          Macchinari, digitalizzazione, formazione, nuove assunzioni: verifichiamo se può essere sostenuto da
          un&apos;agevolazione, prima che il bando giusto scada.
        </p>
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#FF2D16] px-6 text-[14px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,45,22,0.55)] transition-all hover:bg-[#e0210d] active:scale-[0.97]"
        >
          Verifica la tua Partita IVA <ArrowIcon className="h-3.5 w-3.5" />
        </a>
      </Reveal>
    </section>
  );
}

const VOCI_MARQUEE = [
  { label: "Fondo perduto", colore: "#FF2D16" },
  { label: "Credito d'imposta", colore: "#198FD9" },
  { label: "Tasso zero", colore: "#65BD7D" },
  { label: "Bandi regionali", colore: "#E4A858" },
  { label: "Bandi camerali", colore: "#198FD9" },
  { label: "Investimenti 4.0", colore: "#FF2D16" },
];

function Marquee() {
  const voci = [...VOCI_MARQUEE, ...VOCI_MARQUEE];
  return (
    <section className="overflow-hidden border-y border-[#2B2E34]/[0.06] bg-white py-8">
      <p className="mb-5 text-center text-[13px] font-bold uppercase tracking-wider text-[#2B2E34]/35">Le tipologie che monitoriamo</p>
      <div className="flex w-max">
        <div className="molo-marquee-track flex shrink-0 items-center gap-3 pr-3">
          {voci.map((c, i) => (
            <span
              key={`${c.label}-${i}`}
              className="molo-display shrink-0 rounded-full px-5 py-2.5 text-[15px] font-bold"
              style={{ backgroundColor: `${c.colore}14`, color: c.colore }}
            >
              {c.label}
            </span>
          ))}
        </div>
        <div aria-hidden className="molo-marquee-track flex shrink-0 items-center gap-3 pr-3">
          {voci.map((c, i) => (
            <span
              key={`dup-${c.label}-${i}`}
              className="molo-display shrink-0 rounded-full px-5 py-2.5 text-[15px] font-bold"
              style={{ backgroundColor: `${c.colore}14`, color: c.colore }}
            >
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterLanding() {
  return (
    <footer className="bg-[#2B2E34] px-4 py-10 text-center sm:py-12">
      <Image src="/molo-logo.png" alt="MOLO 4.0" width={300} height={89} className="mx-auto h-7 w-auto opacity-90 brightness-0 invert" />
      <p className="molo-display mt-3 text-[14px] font-bold text-white/50">Governa la crescita.</p>
      <p className="mx-auto mt-4 max-w-md text-[12px] leading-relaxed text-white/30">
        Il matching mostrato è sempre indicativo: verifica sempre i requisiti completi sulla fonte ufficiale prima di
        procedere. © {new Date().getFullYear()} MOLO 4.0. Tutti i diritti riservati.
      </p>
    </footer>
  );
}

/* --------------------------------- Icone ----------------------------------- */

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
