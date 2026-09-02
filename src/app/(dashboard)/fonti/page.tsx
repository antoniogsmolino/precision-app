"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import clsx from "clsx";

interface Fonte {
  id: string;
  nome: string;
  livello: "L1_NAZIONALE" | "L2_REGIONALE" | "L3_CAMERALE";
  regione: string | null;
  url: string;
  parserKey: string;
  /** Se impostato, la fonte è gestita dal nuovo motore bandi (src/lib/motore-bandi/) — "Scansiona ora" deve chiamare l'endpoint corretto, non quello del vecchio motore. */
  adapterKey: string | null;
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
  SUCCESSO: "bg-growth-50 text-growth-700 border-growth-500/25",
  ERRORE: "bg-brand-50 text-brand-700 border-brand-200",
  BLOCCATO_ROBOTS: "bg-urgency-50 text-urgency-700 border-urgency-500/25",
};

type FiltroLivello = "TUTTI" | "L1_NAZIONALE" | "L2_REGIONALE" | "L3_CAMERALE";
type FiltroEsito = "TUTTI" | "SUCCESSO" | "ERRORE" | "MAI_SCANSIONATA";

export default function FontiPage() {
  const [fonti, setFonti] = useState<Fonte[] | null>(null);
  const [scansioneInCorso, setScansioneInCorso] = useState<string | null>(null);
  const [scansioneBatchInCorso, setScansioneBatchInCorso] = useState(false);
  const [esitoBatch, setEsitoBatch] = useState<string | null>(null);
  const [filtroLivello, setFiltroLivello] = useState<FiltroLivello>("TUTTI");
  const [filtroEsito, setFiltroEsito] = useState<FiltroEsito>("TUTTI");

  function ricarica() {
    fetch("/api/fonti")
      .then((r) => r.json())
      .then(setFonti);
  }

  useEffect(ricarica, []);

  async function scansionaOra(fonte: Fonte) {
    setScansioneInCorso(fonte.id);
    // Fonte del nuovo motore bandi (adapterKey impostato) vs vecchio
    // motore (parserKey, HTML): endpoint diverso, altrimenti il vecchio
    // motore risponderebbe "nessun parser registrato" su una fonte che
    // non gli appartiene.
    const endpoint = fonte.adapterKey ? `/api/fonti/${fonte.id}/ingest-motore-bandi` : `/api/fonti/${fonte.id}/scan`;
    await fetch(endpoint, { method: "POST" });
    setScansioneInCorso(null);
    ricarica();
  }

  async function scansionaTutte() {
    setScansioneBatchInCorso(true);
    setEsitoBatch(null);
    try {
      const res = await fetch("/api/fonti/scan-tutte", { method: "POST" });
      const data = await res.json();
      const risultati: { saltata: boolean; esito?: string }[] = data.risultati ?? [];
      const successi = risultati.filter((r) => r.esito === "SUCCESSO").length;
      const errori = risultati.filter((r) => r.esito === "ERRORE" || r.esito === "BLOCCATO_ROBOTS").length;
      const saltate = risultati.filter((r) => r.saltata).length;
      setEsitoBatch(`Scan completato: ${successi} ok, ${errori} in errore, ${saltate} saltate (non ancora dovute).`);
    } catch {
      setEsitoBatch("Lo scan si è interrotto (probabile limite di durata della piattaforma): quanto già fatto è comunque salvato — rilancia per proseguire con le fonti rimaste.");
    }
    setScansioneBatchInCorso(false);
    ricarica();
  }

  const riepilogo = useMemo(() => {
    if (!fonti) return null;
    return {
      totale: fonti.length,
      successo: fonti.filter((f) => f.ultimoEsitoScan === "SUCCESSO").length,
      errore: fonti.filter((f) => f.ultimoEsitoScan === "ERRORE" || f.ultimoEsitoScan === "BLOCCATO_ROBOTS").length,
      maiScansionate: fonti.filter((f) => !f.ultimaScansioneAt).length,
      misureTotali: fonti.reduce((tot, f) => tot + f._count.misure, 0),
    };
  }, [fonti]);

  const fontiFiltrate = useMemo(() => {
    if (!fonti) return [];
    return fonti.filter((f) => {
      if (filtroLivello !== "TUTTI" && f.livello !== filtroLivello) return false;
      if (filtroEsito === "SUCCESSO" && f.ultimoEsitoScan !== "SUCCESSO") return false;
      if (filtroEsito === "ERRORE" && f.ultimoEsitoScan !== "ERRORE" && f.ultimoEsitoScan !== "BLOCCATO_ROBOTS") return false;
      if (filtroEsito === "MAI_SCANSIONATA" && f.ultimaScansioneAt) return false;
      return true;
    });
  }, [fonti, filtroLivello, filtroEsito]);

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Fonti monitorate</h1>
          <p className="mt-0.5 text-sm text-ink/40">
            Il motore scansiona queste fonti a ritmo giornaliero, rispettando sempre il robots.txt di ciascun sito.
          </p>
        </div>
        <Button size="sm" onClick={scansionaTutte} disabled={scansioneBatchInCorso}>
          {scansioneBatchInCorso ? "Scansione di tutte le fonti…" : "Scansiona tutte ora"}
        </Button>
      </div>

      {esitoBatch && (
        <div className="mt-4 rounded-xl border border-navigation-500/20 bg-navigation-50 px-4 py-3 text-sm text-navigation-700 animate-fade-in">
          {esitoBatch}
        </div>
      )}

      {riepilogo && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <RiepilogoTile label="Fonti totali" valore={riepilogo.totale} />
          <RiepilogoTile label="Ultimo scan ok" valore={riepilogo.successo} colore="text-growth-700" />
          <RiepilogoTile label="In errore" valore={riepilogo.errore} colore="text-brand-600" />
          <RiepilogoTile label="Mai scansionate" valore={riepilogo.maiScansionate} colore="text-urgency-700" />
          <RiepilogoTile label="Misure rilevate" valore={riepilogo.misureTotali} colore="text-navigation-600" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <FiltroPill attivo={filtroLivello === "TUTTI"} onClick={() => setFiltroLivello("TUTTI")}>
          Tutti i livelli
        </FiltroPill>
        {(Object.entries(LIVELLO_LABEL) as [FiltroLivello, string][]).map(([v, l]) => (
          <FiltroPill key={v} attivo={filtroLivello === v} onClick={() => setFiltroLivello(v)}>
            {l}
          </FiltroPill>
        ))}
        <div className="mx-1 h-4 w-px bg-ink/15" />
        <FiltroPill attivo={filtroEsito === "TUTTI"} onClick={() => setFiltroEsito("TUTTI")}>
          Ogni esito
        </FiltroPill>
        <FiltroPill attivo={filtroEsito === "ERRORE"} onClick={() => setFiltroEsito("ERRORE")}>
          Solo errori
        </FiltroPill>
        <FiltroPill attivo={filtroEsito === "MAI_SCANSIONATA"} onClick={() => setFiltroEsito("MAI_SCANSIONATA")}>
          Mai scansionate
        </FiltroPill>
      </div>

      {!fonti && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {fontiFiltrate.map((f, i) => {
          const ultimoLog = f.scanLogs[0];
          return (
            <Card key={f.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink/90">{f.nome}</p>
                    <Badge className="border-ink/10 bg-ink/[0.04] text-ink/60">{LIVELLO_LABEL[f.livello]}</Badge>
                    {f.regione && <Badge className="border-ink/10 bg-ink/[0.04] text-ink/60">{f.regione}</Badge>}
                    {!f.attiva && <Badge className="border-ink/10 bg-ink/[0.06] text-ink/40">Disattivata</Badge>}
                  </div>
                  <a href={f.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-600 hover:underline">
                    {f.url}
                  </a>
                  <p className="mt-1.5 text-xs text-ink/40">
                    {f._count.misure} misure rilevate ·{" "}
                    {f.ultimaScansioneAt
                      ? `ultima scansione ${new Date(f.ultimaScansioneAt).toLocaleString("it-IT")}`
                      : "mai scansionata"}
                  </p>
                  {ultimoLog?.messaggioErrore && (
                    <p className="mt-1 text-xs text-brand-600">{ultimoLog.messaggioErrore}</p>
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
                    onClick={() => scansionaOra(f)}
                  >
                    {scansioneInCorso === f.id ? "Scansione…" : "Scansiona ora"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {fonti && fontiFiltrate.length === 0 && (
          <p className="py-10 text-center text-sm text-ink/40">Nessuna fonte corrisponde ai filtri selezionati.</p>
        )}
      </div>
    </div>
  );
}

function RiepilogoTile({ label, valore, colore }: { label: string; valore: number; colore?: string }) {
  return (
    <Card>
      <CardBody className="pt-4">
        <p className="text-xs font-medium text-ink/40">{label}</p>
        <p className={clsx("mt-1 text-2xl font-bold", colore ?? "text-ink")}>{valore}</p>
      </CardBody>
    </Card>
  );
}

function FiltroPill({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        attivo ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink/10 bg-white text-ink/60 hover:border-ink/20",
      )}
    >
      {children}
    </button>
  );
}
