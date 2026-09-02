"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiltriBar } from "@/components/dashboard/filtri-bar";
import { TimelineGantt, type TimelineGanttHandle } from "@/components/dashboard/timeline-gantt";
import { TimelineToolbar } from "@/components/dashboard/timeline-toolbar";
import { MisuraCard, type MisuraCardData } from "@/components/dashboard/misura-card";
import { Button } from "@/components/ui/button";
import { SkeletonCard, SkeletonTimeline } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { STATO_TIMELINE_COLOR, STATO_LABEL, type StatoMisura } from "@/lib/misure/stato";
import {
  FILTRI_VUOTI,
  filtraMisure,
  ordinaMisurePerUrgenza,
  ordinaMisurePerUscita,
  type FiltriMisure,
  type OrdinamentoMisure,
} from "@/lib/misure/filtri";
import { Input } from "@/components/ui/input";
import clsx from "clsx";

type Vista = "elenco" | "timeline";

// Oltre questa soglia la Gantt smette di essere leggibile (barre
// sovrapposte, scale illeggibili su mobile) — l'elenco ordinato per
// urgenza resta la vista di riferimento a qualunque numero di misure, la
// timeline è pensata per un sottoinsieme filtrato più piccolo.
const SOGLIA_TIMELINE_LEGGIBILE = 60;

const contatore = new Intl.NumberFormat("it-IT");

export default function DashboardPage() {
  const router = useRouter();
  const timelineRef = useRef<TimelineGanttHandle>(null);
  const [misure, setMisure] = useState<MisuraCardData[] | null>(null);
  const [fonti, setFonti] = useState<{ id: string; nome: string }[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriMisure>(FILTRI_VUOTI);
  const [vista, setVista] = useState<Vista>("elenco");
  const [ordinamento, setOrdinamento] = useState<OrdinamentoMisure>("scadenza");

  useEffect(() => {
    Promise.all([
      fetch("/api/misure").then((r) => {
        if (!r.ok) throw new Error("Errore nel caricamento delle misure");
        return r.json();
      }),
      fetch("/api/fonti").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([m, f]) => {
        setMisure(m);
        setFonti(f);
      })
      .catch((e) => setErrore(e.message));
  }, []);

  const misureFiltrate = useMemo(() => (misure ? filtraMisure(misure, filtri) : []), [misure, filtri]);
  const misureOrdinate = useMemo(
    () => (ordinamento === "scadenza" ? ordinaMisurePerUrgenza(misureFiltrate) : ordinaMisurePerUscita(misureFiltrate)),
    [misureFiltrate, ordinamento],
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero d'apertura: il radar è la pagina più visitata del tool, il
          numero di bandi trovati (non un contatore anonimo di "misure") è
          la prima cosa che deve saltare all'occhio — richiesta esplicita
          del team di dare "un impatto visivo di grande effetto" qui. */}
      <div className="relative overflow-hidden border-b border-ink/[0.06] bg-gradient-to-br from-brand-50 via-white to-white px-4 py-6 sm:px-6 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-navigation-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Radar finanza agevolata</p>
            <h1 className="mt-1 flex items-baseline gap-2 text-[26px] font-extrabold leading-tight text-ink sm:text-[32px]">
              {misure === null ? "…" : contatore.format(misureFiltrate.length)}
              <span className="text-[15px] font-semibold text-ink/40 sm:text-base">
                {misure && misureFiltrate.length !== misure.length
                  ? `di ${contatore.format(misure.length)} bandi`
                  : "bandi trovati"}
              </span>
            </h1>
            <p className="mt-1 hidden text-sm text-ink/50 sm:block">
              Tutti i bandi di finanza agevolata monitorati, aggiornati automaticamente dalle fonti ufficiali.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-ink/10 bg-white p-0.5 shadow-sm">
              <ToggleVista label="Elenco" attivo={vista === "elenco"} onClick={() => setVista("elenco")} />
              <ToggleVista label="Timeline" attivo={vista === "timeline"} onClick={() => setVista("timeline")} />
            </div>
            <Link href="/misure/nuova" className="shrink-0">
              <Button size="sm" className="sm:h-9 sm:px-4 sm:text-sm">
                + Nuova misura
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Pannello di controllo: ricerca, ordinamento e filtri raggruppati
          in un unico blocco visivamente compatto — con centinaia di bandi
          in radar, questo è il pannello su cui il team passa più tempo. */}
      <div className="sticky top-0 z-10 border-b border-ink/[0.06] bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Input
            type="search"
            placeholder="Cerca per titolo o ente…"
            value={filtri.testoLibero}
            onChange={(e) => setFiltri({ ...filtri, testoLibero: e.target.value })}
            className="w-full sm:max-w-sm"
          />

          {vista === "elenco" && (
            <div className="flex shrink-0 items-center gap-2 text-[13px]">
              <span className="text-ink/40">Ordina per</span>
              <div className="flex rounded-full border border-ink/10 bg-ink/[0.03] p-0.5">
                <ToggleVista label="Scadenza" attivo={ordinamento === "scadenza"} onClick={() => setOrdinamento("scadenza")} />
                <ToggleVista label="Uscita" attivo={ordinamento === "uscita"} onClick={() => setOrdinamento("uscita")} />
              </div>
            </div>
          )}
        </div>

        <FiltriBar filtri={filtri} onChange={setFiltri} fontiDisponibili={fonti} />
      </div>

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {errore && (
          <div className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{errore}</div>
        )}

        {!misure && !errore && vista === "timeline" && <SkeletonTimeline />}
        {!misure && !errore && vista === "elenco" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {misure && misure.length === 0 && (
          <EmptyState
            title="Nessuna misura ancora censita"
            description="Aggiungi una misura manualmente, oppure attendi il primo giro del monitoraggio automatico sulle fonti configurate."
            action={
              <Link href="/misure/nuova">
                <Button>Aggiungi la prima misura</Button>
              </Link>
            }
          />
        )}

        {misure && misure.length > 0 && misureFiltrate.length === 0 && (
          <EmptyState
            title="Nessuna misura corrisponde ai filtri"
            description="Prova ad allargare i criteri di ricerca."
            action={
              <Button variant="secondary" onClick={() => setFiltri(FILTRI_VUOTI)}>
                Azzera filtri
              </Button>
            }
          />
        )}

        {misure && misureFiltrate.length > 0 && vista === "timeline" && (
          <div className="rounded-2xl border border-ink/10 bg-white p-2.5 shadow-card sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1.5 sm:px-0">
              <Legenda />
              <TimelineToolbar timelineRef={timelineRef} />
            </div>
            {misureFiltrate.length > SOGLIA_TIMELINE_LEGGIBILE && (
              <p className="mb-3 rounded-lg bg-urgency-50 px-3 py-2 text-xs text-urgency-700">
                {misureFiltrate.length} misure in questa vista: oltre le {SOGLIA_TIMELINE_LEGGIBILE} le barre si
                accavallano e diventa difficile leggerla. Restringi con i filtri, oppure passa a &quot;Elenco&quot;
                — resta leggibile a qualunque numero, sempre ordinato per urgenza.
              </p>
            )}
            <TimelineGantt ref={timelineRef} misure={misureFiltrate} onSelect={(id) => router.push(`/misure/${id}`)} />
          </div>
        )}

        {misure && misureFiltrate.length > 0 && vista === "elenco" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {misureOrdinate.map((m, i) => (
              <div key={m.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <MisuraCard misura={m} />
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-ink/40">
          Il matching mostrato è sempre indicativo: verifica sempre i requisiti completi sulla fonte ufficiale prima di procedere con un&apos;azienda.
        </p>
      </div>
    </div>
  );
}

function ToggleVista({ label, attivo, onClick }: { label: string; attivo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ease-glass",
        attivo ? "bg-brand-600 text-white shadow-sm" : "text-ink/50 hover:text-ink/80",
      )}
    >
      {label}
    </button>
  );
}

function Legenda() {
  const stati: StatoMisura[] = ["FUTURA", "ATTIVA", "IN_SCADENZA", "SCADUTA"];
  return (
    <div className="flex flex-wrap items-center gap-4 px-1">
      {stati.map((s) => (
        <div key={s} className="flex items-center gap-1.5 text-xs text-ink/50">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATO_TIMELINE_COLOR[s].bg }}
          />
          {STATO_LABEL[s]}
        </div>
      ))}
    </div>
  );
}
