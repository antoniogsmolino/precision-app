"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Fonte {
  id: string;
  nome: string;
  livello: "L1_NAZIONALE" | "L2_REGIONALE" | "L3_CAMERALE";
  regione: string | null;
  url: string;
  parserKey: string;
  attiva: boolean;
  frequenzaOreScan: number;
  ultimaScansioneAt: string | null;
  ultimoEsitoScan: "SUCCESSO" | "ERRORE" | "BLOCCATO_ROBOTS" | null;
  _count: { misure: number };
  scanLogs: { esito: string; misureNuove: number; misureAggiornate: number; messaggioErrore: string | null; avviatoAt: string }[];
}

const LIVELLO_LABEL: Record<string, string> = {
  L1_NAZIONALE: "Livello 1 · Nazionale",
  L2_REGIONALE: "Livello 2 · Regionale",
  L3_CAMERALE: "Livello 3 · Camerale",
};

const ESITO_STYLE: Record<string, string> = {
  SUCCESSO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ERRORE: "bg-red-50 text-red-700 border-red-200",
  BLOCCATO_ROBOTS: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function FontiPage() {
  const [fonti, setFonti] = useState<Fonte[] | null>(null);
  const [scansioneInCorso, setScansioneInCorso] = useState<string | null>(null);

  function ricarica() {
    fetch("/api/fonti")
      .then((r) => r.json())
      .then(setFonti);
  }

  useEffect(ricarica, []);

  async function scansionaOra(id: string) {
    setScansioneInCorso(id);
    await fetch(`/api/fonti/${id}/scan`, { method: "POST" });
    setScansioneInCorso(null);
    ricarica();
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-2">
        <h1 className="text-lg font-semibold text-slate-900">Fonti monitorate</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Il motore scansiona queste fonti a ritmo giornaliero, rispettando sempre il robots.txt di ciascun sito.
        </p>
      </div>

      {!fonti && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {fonti?.map((f) => {
          const ultimoLog = f.scanLogs[0];
          return (
            <Card key={f.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">{f.nome}</p>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-500">{LIVELLO_LABEL[f.livello]}</Badge>
                    {f.regione && <Badge className="border-slate-200 bg-slate-50 text-slate-500">{f.regione}</Badge>}
                    {!f.attiva && <Badge className="border-slate-200 bg-slate-100 text-slate-400">Disattivata</Badge>}
                  </div>
                  <a href={f.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-600 hover:underline">
                    {f.url}
                  </a>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {f._count.misure} misure rilevate ·{" "}
                    {f.ultimaScansioneAt
                      ? `ultima scansione ${new Date(f.ultimaScansioneAt).toLocaleString("it-IT")}`
                      : "mai scansionata"}
                  </p>
                  {ultimoLog?.messaggioErrore && (
                    <p className="mt-1 text-xs text-red-500">{ultimoLog.messaggioErrore}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {f.ultimoEsitoScan && (
                    <Badge className={ESITO_STYLE[f.ultimoEsitoScan]}>{f.ultimoEsitoScan.replace("_", " ")}</Badge>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={scansioneInCorso === f.id}
                    onClick={() => scansionaOra(f.id)}
                  >
                    {scansioneInCorso === f.id ? "Scansione…" : "Scansiona ora"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
