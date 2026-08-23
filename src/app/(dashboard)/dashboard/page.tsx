"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiltriBar } from "@/components/dashboard/filtri-bar";
import { TimelineGantt, type TimelineGanttHandle } from "@/components/dashboard/timeline-gantt";
import { TimelineToolbar } from "@/components/dashboard/timeline-toolbar";
import { AlertScadenze } from "@/components/dashboard/alert-scadenze";
import { KpiPanel } from "@/components/dashboard/kpi-panel";
import { MisuraCard, type MisuraCardData } from "@/components/dashboard/misura-card";
import { Button } from "@/components/ui/button";
import { SkeletonCard, SkeletonTimeline } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { STATO_TIMELINE_COLOR, STATO_LABEL, type StatoMisura } from "@/lib/misure/stato";
import { FILTRI_VUOTI, filtraMisure, type FiltriMisure } from "@/lib/misure/filtri";
import clsx from "clsx";

type Vista = "timeline" | "elenco";

export default function DashboardPage() {
  const router = useRouter();
  const timelineRef = useRef<TimelineGanttHandle>(null);
  const [misure, setMisure] = useState<MisuraCardData[] | null>(null);
  const [fonti, setFonti] = useState<{ id: string; nome: string }[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<FiltriMisure>(FILTRI_VUOTI);
  const [vista, setVista] = useState<Vista>("timeline");

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Radar misure</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Tutte le misure di finanza agevolata monitorate, in un colpo d&apos;occhio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <ToggleVista label="Timeline" attivo={vista === "timeline"} onClick={() => setVista("timeline")} />
            <ToggleVista label="Elenco" attivo={vista === "elenco"} onClick={() => setVista("elenco")} />
          </div>
          <Link href="/misure/nuova">
            <Button>+ Nuova misura</Button>
          </Link>
        </div>
      </header>

      {misure && (
        <div className="px-6 pt-6">
          <AlertScadenze misure={misure} />
          <KpiPanel />
        </div>
      )}

      <FiltriBar filtri={filtri} onChange={setFiltri} fontiDisponibili={fonti} />

      <div className="flex-1 px-6 py-6">
        {errore && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errore}</div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Legenda />
              <TimelineToolbar timelineRef={timelineRef} />
            </div>
            <TimelineGantt ref={timelineRef} misure={misureFiltrate} onSelect={(id) => router.push(`/misure/${id}`)} />
          </div>
        )}

        {misure && misureFiltrate.length > 0 && vista === "elenco" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {misureFiltrate.map((m) => (
              <MisuraCard key={m.id} misura={m} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
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
        "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
        attivo ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
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
        <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
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
