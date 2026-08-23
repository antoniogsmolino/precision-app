"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ProspectRiga {
  id: string;
  ragioneSociale: string;
  piva: string;
  ateco: string | null;
  regione: string | null;
  provincia: string | null;
  fatturato: number | string | null;
  numeroDipendenti: number | null;
  email: string | null;
  telefono: string | null;
  _count: { matches: number };
  matches: { id: string; misura: { id: string; titolo: string } }[];
}

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function ProspectPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8"><Skeleton className="h-10 w-full" /></div>}>
      <ProspectContent />
    </Suspense>
  );
}

function ProspectContent() {
  const searchParams = useSearchParams();
  const misuraIdFiltro = searchParams.get("misuraId");
  const evidenziaId = searchParams.get("evidenzia");

  const [prospect, setProspect] = useState<ProspectRiga[] | null>(null);
  const [ricerca, setRicerca] = useState("");
  const [espansi, setEspansi] = useState<Set<string>>(new Set());
  const [nomeMisuraFiltro, setNomeMisuraFiltro] = useState<string | null>(null);

  useEffect(() => {
    const url = misuraIdFiltro ? `/api/prospect?misuraId=${misuraIdFiltro}` : "/api/prospect";
    fetch(url)
      .then((r) => r.json())
      .then(setProspect);

    if (misuraIdFiltro) {
      fetch(`/api/misure/${misuraIdFiltro}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => setNomeMisuraFiltro(m?.titolo ?? null));
    }
  }, [misuraIdFiltro]);

  const filtrati = useMemo(() => {
    if (!prospect) return [];
    const q = ricerca.trim().toLowerCase();
    if (!q) return prospect;
    return prospect.filter(
      (p) => p.ragioneSociale.toLowerCase().includes(q) || p.piva.toLowerCase().includes(q),
    );
  }, [prospect, ricerca]);

  function toggleEspanso(id: string) {
    setEspansi((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Prospect</h1>
          <p className="mt-0.5 text-sm text-slate-400">Anagrafiche importate e relativo matching con le misure.</p>
        </div>
        <Link href="/prospect/importa">
          <Button>Importa CSV</Button>
        </Link>
      </div>

      {misuraIdFiltro && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5 text-[13px] text-brand-700">
          <span>
            Mostrando solo i prospect idonei a <strong>{nomeMisuraFiltro ?? "…"}</strong>
          </span>
          <Link href="/prospect" className="font-medium underline">
            Rimuovi filtro
          </Link>
        </div>
      )}

      <Input
        placeholder="Cerca per ragione sociale o P.IVA…"
        className="mb-4 max-w-sm"
        value={ricerca}
        onChange={(e) => setRicerca(e.target.value)}
      />

      {!prospect && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {prospect && prospect.length === 0 && (
        <EmptyState
          title="Nessun prospect importato"
          description="Carica un file CSV (es. export Atoka) per iniziare a popolare l'anagrafica."
          action={
            <Link href="/prospect/importa">
              <Button>Importa il primo file</Button>
            </Link>
          }
        />
      )}

      {prospect && prospect.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Ragione sociale</th>
                <th className="px-4 py-3 font-medium">P.IVA</th>
                <th className="px-4 py-3 font-medium">ATECO</th>
                <th className="px-4 py-3 font-medium">Regione</th>
                <th className="px-4 py-3 font-medium">Fatturato</th>
                <th className="px-4 py-3 font-medium">Dipendenti</th>
                <th className="px-4 py-3 font-medium">Misure idonee</th>
              </tr>
            </thead>
            <tbody>
              {filtrati.map((p) => (
                <Fragment key={p.id}>
                  <tr
                    key={p.id}
                    id={`prospect-${p.id}`}
                    className={
                      "border-t border-slate-50 transition-colors " +
                      (evidenziaId === p.id ? "bg-brand-50/60" : "hover:bg-slate-50/60")
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{p.ragioneSociale}</td>
                    <td className="px-4 py-3 text-slate-500">{p.piva}</td>
                    <td className="px-4 py-3 text-slate-500">{p.ateco ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.regione ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.fatturato ? euro.format(Number(p.fatturato)) : "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.numeroDipendenti ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEspanso(p.id)}
                        disabled={p._count.matches === 0}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-default disabled:opacity-50"
                      >
                        {p._count.matches} misur{p._count.matches === 1 ? "a" : "e"}
                        {p._count.matches > 0 && <span>{espansi.has(p.id) ? "▲" : "▼"}</span>}
                      </button>
                    </td>
                  </tr>
                  {espansi.has(p.id) && p._count.matches > 0 && (
                    <tr className="border-t border-slate-50 bg-slate-50/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {p.matches.map((m) => (
                            <Link key={m.id} href={`/misure/${m.misura.id}`}>
                              <Badge className="border-brand-100 bg-white text-brand-700 hover:bg-brand-50">
                                {m.misura.titolo}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Il matching è indicativo: verifica sempre i requisiti completi prima di proporre una misura a un&apos;azienda.
      </p>
    </div>
  );
}
