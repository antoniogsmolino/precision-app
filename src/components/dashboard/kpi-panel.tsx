"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RigaKpi {
  misuraId: string;
  titolo: string;
  candidate: number;
  ammesse: number;
  contrattiAttivi: number;
  respinte: number;
}

interface DatiKpi {
  totali: { candidate: number; ammesse: number; contrattiAttivi: number; respinte: number };
  perMisura: RigaKpi[];
}

const TILES: { chiave: keyof DatiKpi["totali"]; label: string; colore: string }[] = [
  { chiave: "candidate", label: "Aziende candidate", colore: "text-navigation-600" },
  { chiave: "ammesse", label: "Aziende ammesse", colore: "text-growth-700" },
  { chiave: "contrattiAttivi", label: "Contratti attivi", colore: "text-brand-600" },
];

export function KpiPanel() {
  const [dati, setDati] = useState<DatiKpi | null>(null);

  useEffect(() => {
    fetch("/api/kpi")
      .then((r) => (r.ok ? r.json() : null))
      .then(setDati);
  }, []);

  if (dati && dati.totali.candidate + dati.totali.ammesse + dati.totali.contrattiAttivi + dati.totali.respinte === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TILES.map((t, i) => (
          <Card key={t.chiave} className="animate-rise-in" style={{ animationDelay: `${i * 60}ms` }}>
            <CardBody className="pt-5">
              <p className="text-xs font-medium text-ink/40">{t.label}</p>
              {!dati ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className={`mt-1 text-3xl font-bold ${t.colore}`}>{dati.totali[t.chiave]}</p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {dati && dati.perMisura.length > 0 && (
        <Card className="mt-4">
          <CardBody className="pt-5">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink/40">
              Pipeline per misura
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-xs uppercase tracking-wide text-ink/40">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Misura</th>
                    <th className="py-1.5 pr-3 font-medium">Candidate</th>
                    <th className="py-1.5 pr-3 font-medium">Ammesse</th>
                    <th className="py-1.5 pr-3 font-medium">Contratti attivi</th>
                  </tr>
                </thead>
                <tbody>
                  {dati.perMisura.slice(0, 8).map((r) => (
                    <tr key={r.misuraId} className="border-t border-ink/[0.04]">
                      <td className="py-2 pr-3">
                        <Link href={`/misure/${r.misuraId}`} className="font-medium text-ink/80 hover:text-brand-600">
                          {r.titolo}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-ink/50">{r.candidate}</td>
                      <td className="py-2 pr-3 text-ink/50">{r.ammesse}</td>
                      <td className="py-2 pr-3 text-ink/50">{r.contrattiAttivi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
