"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { StatoBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/input";
import { calcolaStatoMisura, giorniAllaScadenza } from "@/lib/misure/stato";
import { formatValoreMisura, CATEGORIA_LABEL, TIPO_AGEVOLAZIONE_LABEL } from "@/lib/misure/valore";

const dataFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STATO_PRATICA_LABEL: Record<string, string> = {
  CANDIDATA: "Candidata",
  AMMESSA: "Ammessa",
  RESPINTA: "Respinta",
  CONTRATTO_ATTIVO: "Contratto attivo",
};

interface MatchConProspect {
  id: string;
  criteriEsito: string[];
  statoPratica: string;
  prospect: {
    id: string;
    ragioneSociale: string;
    piva: string;
    regione: string | null;
    ateco: string | null;
    fatturato: number | string | null;
  };
}

interface MisuraDettaglio {
  id: string;
  titolo: string;
  ente: string;
  categoria: string;
  descrizioneBreve: string;
  descrizioneEstesa: string;
  tipoAgevolazione: string;
  tipoValore: "IMPORTO_FISSO" | "RANGE" | "PERCENTUALE";
  importoFisso: number | string | null;
  importoMin: number | string | null;
  importoMax: number | string | null;
  percentuale: number | string | null;
  tettoMassimo: number | string | null;
  dataApertura: string;
  dataScadenza: string;
  scadenzaStimata: boolean;
  atecoAmmessi: string[];
  atecoEsclusi: string[];
  regioniAmmesse: string[];
  fatturatoMin: number | string | null;
  fatturatoMax: number | string | null;
  dipendentiMin: number | null;
  dipendentiMax: number | null;
  altriRequisiti: string | null;
  documentiRichiesti: string[];
  linkFonteUfficiale: string;
  noteInterne: string | null;
  rilevataAutomaticamente: boolean;
  fonte: { nome: string } | null;
  cumulabili: { id: string; titolo: string }[];
}

export default function MisuraDettaglioPage() {
  const { id } = useParams<{ id: string }>();
  const [misura, setMisura] = useState<MisuraDettaglio | null>(null);
  const [prospectIdonei, setProspectIdonei] = useState<MatchConProspect[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function aggiornaStatoPratica(matchId: string, statoPratica: string) {
    setProspectIdonei((prev) =>
      prev ? prev.map((m) => (m.id === matchId ? { ...m, statoPratica } : m)) : prev,
    );
    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statoPratica }),
    });
  }

  useEffect(() => {
    fetch(`/api/misure/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Misura non trovata");
        return r.json();
      })
      .then(setMisura)
      .catch((e) => setErrore(e.message));

    fetch(`/api/misure/${id}/prospect-idonei`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setProspectIdonei)
      .catch(() => setProspectIdonei([]));
  }, [id]);

  if (errore) {
    return (
      <div className="p-6">
        <EmptyState title="Misura non trovata" description={errore} />
      </div>
    );
  }

  if (!misura) return <DettaglioSkeleton />;

  const stato = calcolaStatoMisura(new Date(misura.dataApertura), new Date(misura.dataScadenza));
  const giorni = giorniAllaScadenza(new Date(misura.dataScadenza));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-ink/40 hover:text-ink/65">
        ← Torna al radar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink/40">{misura.ente}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{misura.titolo}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatoBadge stato={stato} scadenzaStimata={misura.scadenzaStimata} />
            <Badge className="border-ink/10 bg-ink/[0.04] text-ink/70">{CATEGORIA_LABEL[misura.categoria]}</Badge>
            <Badge className="border-ink/10 bg-ink/[0.04] text-ink/70">
              {TIPO_AGEVOLAZIONE_LABEL[misura.tipoAgevolazione]}
            </Badge>
            {misura.rilevataAutomaticamente && (
              <Badge className="border-brand-100 bg-brand-50 text-brand-600">
                Rilevata da {misura.fonte?.nome ?? "monitoraggio automatico"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/misure/${misura.id}/modifica`}>
            <Button variant="secondary">Segnala errore / Modifica</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Valore" value={formatValoreMisura(misura)} />
        <StatTile
          label="Finestra"
          value={`${dataFmt.format(new Date(misura.dataApertura))} → ${dataFmt.format(new Date(misura.dataScadenza))}`}
        />
        <StatTile
          label="Scadenza"
          value={
            misura.scadenzaStimata
              ? "Non nota"
              : stato === "SCADUTA"
                ? "Scaduta"
                : stato === "FUTURA"
                  ? "Non ancora aperta"
                  : `Tra ${giorni} giorni`
          }
        />
      </div>

      {misura.scadenzaStimata && (
        <div className="mt-4 rounded-xl border border-urgency-500/25 bg-urgency-50 px-4 py-3 text-[13px] text-urgency-700">
          Il motore non ha trovato una data di scadenza leggibile sulla pagina di origine: quella mostrata
          sopra è solo un segnaposto, non una scadenza reale. Verifica sulla fonte ufficiale (link più sotto)
          prima di usarla, o correggila da &quot;Segnala errore / Modifica&quot;.
        </div>
      )}

      <Card className="mt-6">
        <CardBody className="pt-5">
          <SectionTitle>Descrizione</SectionTitle>
          <p className="text-[13px] leading-relaxed text-ink/50">{misura.descrizioneBreve}</p>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink/65">{misura.descrizioneEstesa}</p>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardBody className="pt-5">
          <SectionTitle>Requisiti di ammissibilità</SectionTitle>
          <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            <Requisito label="ATECO ammessi" value={misura.atecoAmmessi.length ? misura.atecoAmmessi.join(", ") : "Nessuna restrizione"} />
            <Requisito label="ATECO esclusi" value={misura.atecoEsclusi.length ? misura.atecoEsclusi.join(", ") : "—"} />
            <Requisito label="Regioni ammesse" value={misura.regioniAmmesse.length ? misura.regioniAmmesse.join(", ") : "Tutte"} />
            <Requisito
              label="Fatturato"
              value={
                misura.fatturatoMin || misura.fatturatoMax
                  ? `${misura.fatturatoMin ? euro.format(Number(misura.fatturatoMin)) : "—"} – ${misura.fatturatoMax ? euro.format(Number(misura.fatturatoMax)) : "—"}`
                  : "Nessun limite"
              }
            />
            <Requisito
              label="Dipendenti"
              value={
                misura.dipendentiMin || misura.dipendentiMax
                  ? `${misura.dipendentiMin ?? "—"} – ${misura.dipendentiMax ?? "—"}`
                  : "Nessun limite"
              }
            />
          </dl>
          {misura.altriRequisiti && (
            <p className="mt-3 rounded-lg bg-ink/[0.03] p-3 text-[13px] text-ink/65">{misura.altriRequisiti}</p>
          )}
        </CardBody>
      </Card>

      {misura.documentiRichiesti.length > 0 && (
        <Card className="mt-4">
          <CardBody className="pt-5">
            <SectionTitle>Documenti richiesti</SectionTitle>
            <ul className="space-y-1.5">
              {misura.documentiRichiesti.map((doc, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-ink/65">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {doc}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {misura.cumulabili.length > 0 && (
        <Card className="mt-4">
          <CardBody className="pt-5">
            <SectionTitle>Misure cumulabili</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {misura.cumulabili.map((c) => (
                <Link key={c.id} href={`/misure/${c.id}`}>
                  <Badge className="border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100">{c.titolo}</Badge>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mt-4">
        <CardBody className="pt-5">
          <div className="flex items-center justify-between">
            <SectionTitle>
              Prospect idonei {prospectIdonei && `(${prospectIdonei.length})`}
            </SectionTitle>
            {prospectIdonei && prospectIdonei.length > 0 && (
              <a href={`/api/misure/${misura.id}/prospect-idonei?format=csv`}>
                <Button variant="secondary" size="sm">Esporta CSV</Button>
              </a>
            )}
          </div>
          <p className="mb-3 text-xs text-ink/40">
            Match indicativo calcolato dal motore a regole: non è una garanzia di ammissione.
          </p>

          {prospectIdonei === null && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {prospectIdonei && prospectIdonei.length === 0 && (
            <EmptyState title="Nessun prospect idoneo al momento" description="Importa o aggiorna l'anagrafica prospect per trovare nuove corrispondenze." />
          )}

          {prospectIdonei && prospectIdonei.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink/[0.06] text-xs uppercase tracking-wide text-ink/40">
                    <th className="py-2 pr-3 font-medium">Ragione sociale</th>
                    <th className="py-2 pr-3 font-medium">P.IVA</th>
                    <th className="py-2 pr-3 font-medium">Regione</th>
                    <th className="py-2 pr-3 font-medium">ATECO</th>
                    <th className="py-2 pr-3 font-medium">Stato pratica</th>
                  </tr>
                </thead>
                <tbody>
                  {prospectIdonei.map((m) => (
                    <tr key={m.id} className="border-b border-ink/[0.04] last:border-0">
                      <td className="py-2 pr-3 font-medium text-ink/80">
                        <Link href={`/prospect?evidenzia=${m.prospect.id}`} className="hover:text-brand-600">
                          {m.prospect.ragioneSociale}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-ink/50">{m.prospect.piva}</td>
                      <td className="py-2 pr-3 text-ink/50">{m.prospect.regione ?? "—"}</td>
                      <td className="py-2 pr-3 text-ink/50">{m.prospect.ateco ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <Select
                          className="h-8 py-0 text-xs"
                          value={m.statoPratica}
                          onChange={(e) => aggiornaStatoPratica(m.id, e.target.value)}
                        >
                          {Object.entries(STATO_PRATICA_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
        <a
          href={misura.linkFonteUfficiale}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-600 hover:underline"
        >
          Vai alla fonte ufficiale ↗
        </a>
      </div>

      {misura.noteInterne && (
        <Card className="mt-4 border-urgency-500/20 bg-urgency-50/50">
          <CardBody className="pt-5">
            <SectionTitle>Note interne</SectionTitle>
            <p className="whitespace-pre-line text-[13px] text-ink/65">{misura.noteInterne}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink/40">{children}</h2>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <p className="text-xs font-medium text-ink/40">{label}</p>
        <p className="mt-1 text-[15px] font-semibold text-ink">{value}</p>
      </CardBody>
    </Card>
  );
}

function Requisito({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink/40">{label}</dt>
      <dd className="mt-0.5 text-ink/80">{value}</dd>
    </div>
  );
}

function DettaglioSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
