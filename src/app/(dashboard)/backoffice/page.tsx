"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MisuraDaVerificare {
  id: string;
  titolo: string;
  ente: string;
  dataApertura: string;
  dataScadenza: string;
  updatedAt: string;
  evidenze: { campo: string; confidence: number }[];
}

interface MisuraAssente {
  id: string;
  titolo: string;
  ente: string;
  assenzeConsecutive: number;
  ultimoVistoInFonteAt: string | null;
}

interface Coda {
  daVerificare: MisuraDaVerificare[];
  assenti: MisuraAssente[];
}

const dataFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Backoffice di revisione (specifica motore bandi, §42) — due code
 * distinte: bandi a bassa confidence da confermare, e bandi spariti da
 * una fonte da confermare come davvero chiusi (mai chiusi in automatico,
 * §37/§101 punto 4).
 */
export default function BackofficePage() {
  const [coda, setCoda] = useState<Coda | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  function ricarica() {
    fetch("/api/backoffice/coda")
      .then((r) => r.json())
      .then(setCoda);
  }

  useEffect(ricarica, []);

  async function esegui(id: string, azione: string, motivo?: string) {
    setInCorso(id);
    await fetch(`/api/misure/${id}/backoffice-azione`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione, motivo }),
    });
    setInCorso(null);
    ricarica();
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-lg font-semibold text-ink">Backoffice</h1>
      <p className="mt-0.5 text-sm text-ink/40">
        Bandi che il motore non pubblica automaticamente: servono una conferma o una decisione del team.
      </p>

      {!coda && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {coda && (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-ink/70">
              Da verificare <span className="font-normal text-ink/40">({coda.daVerificare.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink/40">
              Confidence bassa su almeno un campo — il motore non li considera ancora verificati (vedi §29 della specifica: mai promuovere automaticamente senza dati sufficientemente affidabili).
            </p>
            <div className="mt-3 space-y-2">
              {coda.daVerificare.length === 0 && (
                <EmptyState title="Nessun bando in attesa di verifica" description="Tutti i bandi rilevati automaticamente hanno raggiunto una confidence sufficiente." />
              )}
              {coda.daVerificare.map((m) => (
                <Card key={m.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/misure/${m.id}`} className="font-medium text-ink/90 hover:underline">
                        {m.titolo}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink/40">
                        {m.ente} · {dataFmt.format(new Date(m.dataApertura))} → {dataFmt.format(new Date(m.dataScadenza))}
                      </p>
                      {m.evidenze.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.evidenze.map((e) => (
                            <Badge key={e.campo} className="border-urgency-500/25 bg-urgency-50 text-urgency-700">
                              {e.campo} · {Math.round(e.confidence * 100)}%
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" disabled={inCorso === m.id} onClick={() => esegui(m.id, "conferma_verifica")}>
                      Conferma
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-ink/70">
              Spariti dalla fonte <span className="font-normal text-ink/40">({coda.assenti.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink/40">
              Non più trovati nelle ultime scansioni — mai chiusi in automatico (§37 della specifica): la sparizione può dipendere da un errore della fonte, non dalla vera chiusura del bando.
            </p>
            <div className="mt-3 space-y-2">
              {coda.assenti.length === 0 && (
                <EmptyState title="Nessun bando sparito da segnalare" description="Tutte le misure rilevate automaticamente risultano ancora presenti nelle rispettive fonti." />
              )}
              {coda.assenti.map((m) => (
                <Card key={m.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/misure/${m.id}`} className="font-medium text-ink/90 hover:underline">
                        {m.titolo}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink/40">
                        {m.ente} · assente da {m.assenzeConsecutive} scansioni consecutive
                        {m.ultimoVistoInFonteAt && ` · vista l'ultima volta il ${dataFmt.format(new Date(m.ultimoVistoInFonteAt))}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={inCorso === m.id} onClick={() => esegui(m.id, "ignora_assenza")}>
                        Ancora valida
                      </Button>
                      <Button size="sm" disabled={inCorso === m.id} onClick={() => esegui(m.id, "conferma_chiusura")}>
                        Conferma chiusura
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
