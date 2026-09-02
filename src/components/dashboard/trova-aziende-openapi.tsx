"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

interface StatoPreRicerca {
  configurato: boolean;
  budget: { residuoOggiEur: number; residuoMeseEur: number };
  stimaCostoMassimoEur: number;
  limiti: { maxCandidatePerRun: number; maxAdvancedPerRun: number };
  ultimoRun: {
    esito: string;
    avviataAt: string;
    candidateTrovate: number;
    aziendeNuove: number;
    aziendeDaCache: number;
    matchTrovati: number;
    costoStimato: number | string;
    messaggioErrore: string | null;
  } | null;
}

interface RisultatoRun {
  ok: boolean;
  candidateTrovate: number;
  aziendeNuove: number;
  aziendeDaCache: number;
  matchTrovati: number;
  costoStimatoEur: number;
  coperturaParziale: boolean;
  messaggioErrore?: string;
}

/**
 * Trigger del motore di prospecting automatico OpenAPI per questa misura
 * (src/lib/prospecting/engine.ts) — sostituisce l'import manuale del CSV:
 * cerca le aziende compatibili con i requisiti strutturati del bando e le
 * arricchisce, spendendo dal budget condiviso. Mai avviato in automatico
 * da questo componente: solo su click esplicito, con la stima di costo
 * massimo mostrata PRIMA di procedere (§10 delle specifiche: "l'acquisizione
 * manuale dei lotti deve restare disponibile").
 */
export function TrovaAziendeOpenApi({ misuraId, onCompletato }: { misuraId: string; onCompletato?: () => void }) {
  const [stato, setStato] = useState<StatoPreRicerca | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [risultato, setRisultato] = useState<RisultatoRun | null>(null);

  function caricaStato() {
    fetch(`/api/misure/${misuraId}/trova-aziende`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStato);
  }

  useEffect(() => {
    caricaStato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [misuraId]);

  async function avvia() {
    if (!stato) return;
    const conferma = window.confirm(
      `Questa ricerca può costare fino a circa ${euro.format(stato.stimaCostoMassimoEur)} (budget residuo oggi: ${euro.format(stato.budget.residuoOggiEur)}). Procedere?`,
    );
    if (!conferma) return;

    setInCorso(true);
    setRisultato(null);
    try {
      const res = await fetch(`/api/misure/${misuraId}/trova-aziende`, { method: "POST" });
      const json = await res.json();
      setRisultato(json);
      caricaStato();
      onCompletato?.();
    } finally {
      setInCorso(false);
    }
  }

  if (!stato) {
    return null; // caricamento silenzioso, non blocca il resto della pagina
  }

  if (!stato.configurato) {
    return (
      <Card className="mt-4">
        <CardBody className="pt-5">
          <EmptyState
            title="Ricerca automatica aziende non configurata"
            description="Imposta OPENAPI_IT_API_KEY per cercare in automatico le aziende compatibili con questo bando invece di importarle da CSV."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mt-4" tono="navigation">
      <CardBody className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-ink">Trova aziende compatibili (OpenAPI)</p>
            <p className="mt-0.5 text-xs text-ink/50">
              Cerca aziende su ATECO/fatturato/dipendenti del bando, arricchisce solo le candidate nuove. Fino a{" "}
              {stato.limiti.maxCandidatePerRun} candidate, {stato.limiti.maxAdvancedPerRun} arricchimenti per ricerca.
            </p>
          </div>
          <Button onClick={avvia} disabled={inCorso || stato.budget.residuoOggiEur <= 0}>
            {inCorso ? "Ricerca in corso…" : "Avvia ricerca"}
          </Button>
        </div>

        <p className="mt-3 text-xs text-ink/40">
          Budget residuo oggi: {euro.format(stato.budget.residuoOggiEur)} · questo mese: {euro.format(stato.budget.residuoMeseEur)} · costo
          massimo stimato per questa ricerca: {euro.format(stato.stimaCostoMassimoEur)}
        </p>

        {risultato && (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 text-[13px]">
            {risultato.ok ? (
              <>
                <p className="font-medium text-ink/80">
                  {risultato.candidateTrovate} candidate trovate · {risultato.aziendeNuove} arricchite ora · {risultato.aziendeDaCache} da cache
                  · {risultato.matchTrovati} match totali per questo bando
                </p>
                <p className="mt-1 text-ink/50">Costo di questo run: {euro.format(risultato.costoStimatoEur)}</p>
                {risultato.coperturaParziale && (
                  <p className="mt-1 text-urgency-700">
                    Copertura parziale: c&apos;erano più candidate di quelle coperte da questo run (limite o budget raggiunto) — rilancia
                    la ricerca per proseguire.
                  </p>
                )}
              </>
            ) : (
              <p className="text-brand-700">Ricerca non riuscita: {risultato.messaggioErrore}</p>
            )}
          </div>
        )}

        {!risultato && stato.ultimoRun && (
          <p className="mt-3 text-xs text-ink/40">
            Ultima ricerca: {new Date(stato.ultimoRun.avviataAt).toLocaleString("it-IT")} — {stato.ultimoRun.esito.toLowerCase()},{" "}
            {stato.ultimoRun.matchTrovati} match
          </p>
        )}
      </CardBody>
    </Card>
  );
}
