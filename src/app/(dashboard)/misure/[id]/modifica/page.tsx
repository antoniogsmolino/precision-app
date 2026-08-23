"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MisuraForm, type MisuraFormValues } from "@/components/dashboard/misura-form";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

function toDateInput(v: string) {
  return v ? new Date(v).toISOString().slice(0, 10) : "";
}
function toStr(v: number | string | null | undefined) {
  return v == null ? "" : String(v);
}

export default function ModificaMisuraPage() {
  const { id } = useParams<{ id: string }>();
  const [valori, setValori] = useState<(Partial<MisuraFormValues> & { titolo: string }) | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/misure/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Misura non trovata");
        return r.json();
      })
      .then((m) => {
        setValori({
          titolo: m.titolo,
          ente: m.ente,
          categoria: m.categoria,
          descrizioneBreve: m.descrizioneBreve,
          descrizioneEstesa: m.descrizioneEstesa,
          tipoAgevolazione: m.tipoAgevolazione,
          tipoValore: m.tipoValore,
          importoFisso: toStr(m.importoFisso),
          importoMin: toStr(m.importoMin),
          importoMax: toStr(m.importoMax),
          percentuale: toStr(m.percentuale),
          tettoMassimo: toStr(m.tettoMassimo),
          dataApertura: toDateInput(m.dataApertura),
          dataScadenza: toDateInput(m.dataScadenza),
          atecoAmmessi: m.atecoAmmessi ?? [],
          atecoEsclusi: m.atecoEsclusi ?? [],
          regioniAmmesse: m.regioniAmmesse ?? [],
          fatturatoMin: toStr(m.fatturatoMin),
          fatturatoMax: toStr(m.fatturatoMax),
          dipendentiMin: toStr(m.dipendentiMin),
          dipendentiMax: toStr(m.dipendentiMax),
          altriRequisiti: m.altriRequisiti ?? "",
          documentiRichiesti: m.documentiRichiesti ?? [],
          linkFonteUfficiale: m.linkFonteUfficiale,
          noteInterne: m.noteInterne ?? "",
          cumulabiliIds: (m.cumulabili ?? []).map((c: { id: string }) => c.id),
        });
      })
      .catch((e) => setErrore(e.message));
  }, [id]);

  if (errore) {
    return (
      <div className="p-6">
        <EmptyState title="Misura non trovata" description={errore} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Modifica misura</h1>
      <p className="mb-6 text-sm text-slate-400">
        Correggi i dati rilevati automaticamente o aggiorna una misura esistente.
      </p>
      {!valori ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <MisuraForm misuraId={id} valoriIniziali={valori} />
      )}
    </div>
  );
}
