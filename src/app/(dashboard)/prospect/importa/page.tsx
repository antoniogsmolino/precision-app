"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { CAMPI_PROSPECT_IMPORTABILI, type ProspectInput } from "@/lib/validation/prospect";

type Step = "upload" | "mappa" | "anteprima" | "fatto";

const SUGGERIMENTI: Record<string, string[]> = {
  ragioneSociale: ["ragione sociale", "denominazione", "azienda", "nome azienda", "company"],
  piva: ["p.iva", "piva", "partita iva", "vat"],
  ateco: ["ateco", "codice ateco", "cod. ateco"],
  regione: ["regione", "region"],
  provincia: ["provincia", "prov", "prov."],
  fatturato: ["fatturato", "revenue", "turnover"],
  numeroDipendenti: ["dipendenti", "addetti", "employees", "n. dipendenti"],
  email: ["email", "e-mail", "pec"],
  telefono: ["telefono", "tel", "phone"],
};

function suggerisciCampo(intestazione: string): string {
  const norm = intestazione.trim().toLowerCase();
  for (const [campo, alias] of Object.entries(SUGGERIMENTI)) {
    if (alias.some((a) => norm.includes(a))) return campo;
  }
  return "";
}

function parseNumero(v: string | undefined): number | null {
  if (!v) return null;
  const pulito = v.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(pulito);
  return Number.isFinite(n) ? n : null;
}

export default function ImportaProspectPage() {
  const [step, setStep] = useState<Step>("upload");
  const [nomeFile, setNomeFile] = useState("");
  const [intestazioni, setIntestazioni] = useState<string[]>([]);
  const [righeGrezze, setRigheGrezze] = useState<Record<string, string>[]>([]);
  const [mappatura, setMappatura] = useState<Record<string, string>>({});
  const [risultato, setRisultato] = useState<{ creati: number; aggiornati: number; scartati: number; erroriRiga: { riga: number; errore: string }[] } | null>(null);
  const [invio, setInvio] = useState(false);
  const [erroreFile, setErroreFile] = useState<string | null>(null);

  function handleFile(file: File) {
    setErroreFile(null);
    setNomeFile(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const campi = res.meta.fields ?? [];
        if (campi.length === 0) {
          setErroreFile("Il file non sembra un CSV valido (nessuna intestazione trovata).");
          return;
        }
        setIntestazioni(campi);
        setRigheGrezze(res.data);
        const mappaturaIniziale: Record<string, string> = {};
        campi.forEach((c) => (mappaturaIniziale[c] = suggerisciCampo(c)));
        setMappatura(mappaturaIniziale);
        setStep("mappa");
      },
      error: (err) => setErroreFile(err.message),
    });
  }

  const righeMappate: ProspectInput[] = useMemo(() => {
    const trovaColonna = (campo: string) => Object.entries(mappatura).find(([, v]) => v === campo)?.[0];
    const colRagioneSociale = trovaColonna("ragioneSociale");
    const colPiva = trovaColonna("piva");
    if (!colRagioneSociale || !colPiva) return [];

    return righeGrezze.map((riga) => ({
      ragioneSociale: riga[colRagioneSociale]?.trim() ?? "",
      piva: riga[colPiva]?.trim() ?? "",
      ateco: trovaColonna("ateco") ? riga[trovaColonna("ateco")!]?.trim() || null : null,
      regione: trovaColonna("regione") ? riga[trovaColonna("regione")!]?.trim() || null : null,
      provincia: trovaColonna("provincia") ? riga[trovaColonna("provincia")!]?.trim() || null : null,
      fatturato: trovaColonna("fatturato") ? parseNumero(riga[trovaColonna("fatturato")!]) : null,
      numeroDipendenti: trovaColonna("numeroDipendenti")
        ? Math.trunc(parseNumero(riga[trovaColonna("numeroDipendenti")!]) ?? NaN) || null
        : null,
      email: trovaColonna("email") ? riga[trovaColonna("email")!]?.trim() || null : null,
      telefono: trovaColonna("telefono") ? riga[trovaColonna("telefono")!]?.trim() || null : null,
      fonteImport: `CSV: ${nomeFile}`,
    }));
  }, [righeGrezze, mappatura, nomeFile]);

  const campiObbligatoriMappati = Object.values(mappatura).includes("ragioneSociale") && Object.values(mappatura).includes("piva");

  async function confermaImport() {
    setInvio(true);
    const res = await fetch("/api/prospect/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ righe: righeMappate }),
    });
    const data = await res.json();
    setRisultato(data);
    setInvio(false);
    setStep("fatto");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/prospect" className="mb-4 inline-flex items-center gap-1 text-sm text-ink/40 hover:text-ink/65">
        ← Torna ai prospect
      </Link>
      <h1 className="mb-1 text-lg font-semibold text-ink">Importa prospect da CSV</h1>
      <p className="mb-6 text-sm text-ink/40">
        Il formato di export (es. Atoka) può cambiare: la mappatura delle colonne si fa qui, a video, ad ogni import.
      </p>

      <Stepper step={step} />

      {step === "upload" && (
        <Card className="mt-6">
          <CardBody className="pt-8 pb-8 text-center">
            <label className="mx-auto flex max-w-sm cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-ink/10 p-8 hover:border-brand-300 hover:bg-brand-50/30">
              <UploadIcon className="h-8 w-8 text-brand-400" />
              <span className="text-sm font-medium text-ink/80">Trascina qui il file CSV o clicca per selezionarlo</span>
              <span className="text-xs text-ink/40">Formato .csv, con intestazioni di colonna</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {erroreFile && <p className="mt-4 text-sm text-danger-700">{erroreFile}</p>}
          </CardBody>
        </Card>
      )}

      {step === "mappa" && (
        <Card className="mt-6">
          <CardBody className="pt-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-ink/50">
                <span className="font-medium text-ink/80">{nomeFile}</span> — {righeGrezze.length} righe trovate
              </p>
            </div>

            <div className="space-y-2.5">
              {intestazioni.map((intestazione) => (
                <div key={intestazione} className="flex flex-col gap-2 rounded-lg border border-ink/[0.06] p-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink/80">{intestazione}</p>
                    <p className="truncate text-xs text-ink/40">
                      es. {righeGrezze[0]?.[intestazione] || "—"}
                    </p>
                  </div>
                  <span className="hidden text-ink/25 sm:inline">→</span>
                  <Select
                    className="w-full sm:w-56"
                    value={mappatura[intestazione] ?? ""}
                    onChange={(e) => setMappatura((m) => ({ ...m, [intestazione]: e.target.value }))}
                  >
                    <option value="">Ignora questa colonna</option>
                    {CAMPI_PROSPECT_IMPORTABILI.map((c) => (
                      <option key={c.chiave} value={c.chiave}>
                        {c.label}
                        {c.obbligatorio ? " *" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            {!campiObbligatoriMappati && (
              <p className="mt-4 text-sm text-urgency-700">
                Mappa almeno Ragione sociale e Partita IVA per continuare.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>
                Indietro
              </Button>
              <Button disabled={!campiObbligatoriMappati} onClick={() => setStep("anteprima")}>
                Avanti — Anteprima
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "anteprima" && (
        <Card className="mt-6">
          <CardBody className="pt-5">
            <p className="mb-3 text-sm text-ink/50">
              Anteprima di {Math.min(5, righeMappate.length)} righe su {righeMappate.length} totali:
            </p>
            <div className="overflow-x-auto rounded-lg border border-ink/[0.06]">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-ink/[0.03] text-xs uppercase tracking-wide text-ink/40">
                  <tr>
                    <th className="px-3 py-2">Ragione sociale</th>
                    <th className="px-3 py-2">P.IVA</th>
                    <th className="px-3 py-2">ATECO</th>
                    <th className="px-3 py-2">Regione</th>
                    <th className="px-3 py-2">Fatturato</th>
                    <th className="px-3 py-2">Dipendenti</th>
                  </tr>
                </thead>
                <tbody>
                  {righeMappate.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-ink/[0.04]">
                      <td className="px-3 py-2">{r.ragioneSociale || <span className="text-danger-600">mancante</span>}</td>
                      <td className="px-3 py-2">{r.piva || <span className="text-danger-600">mancante</span>}</td>
                      <td className="px-3 py-2">{r.ateco ?? "—"}</td>
                      <td className="px-3 py-2">{r.regione ?? "—"}</td>
                      <td className="px-3 py-2">{r.fatturato ?? "—"}</td>
                      <td className="px-3 py-2">{r.numeroDipendenti ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("mappa")}>
                Indietro
              </Button>
              <Button onClick={confermaImport} disabled={invio}>
                {invio ? "Importazione…" : `Importa ${righeMappate.length} prospect`}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === "fatto" && risultato && (
        <Card className="mt-6">
          <CardBody className="pt-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-growth-50 text-growth-700">
              ✓
            </div>
            <p className="text-[15px] font-semibold text-ink">Import completato</p>
            <p className="mt-2 text-sm text-ink/50">
              {risultato.creati} nuovi · {risultato.aggiornati} aggiornati · {risultato.scartati} scartati
            </p>
            {risultato.erroriRiga.length > 0 && (
              <div className="mx-auto mt-4 max-h-40 max-w-md overflow-y-auto rounded-lg bg-danger-50 p-3 text-left text-xs text-danger-700">
                {risultato.erroriRiga.map((e, i) => (
                  <p key={i}>Riga {e.riga}: {e.errore}</p>
                ))}
              </div>
            )}
            <Link href="/prospect" className="mt-6 inline-block">
              <Button>Vai all&apos;elenco prospect</Button>
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const passi: { key: Step; label: string }[] = [
    { key: "upload", label: "Carica CSV" },
    { key: "mappa", label: "Mappa colonne" },
    { key: "anteprima", label: "Anteprima" },
    { key: "fatto", label: "Fatto" },
  ];
  const indiceAttuale = passi.findIndex((p) => p.key === step);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {passi.map((p, i) => (
        <div key={p.key} className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
              (i <= indiceAttuale ? "bg-brand-600 text-white" : "bg-ink/[0.06] text-ink/40")
            }
          >
            {i + 1}
          </div>
          <span
            className={
              "hidden text-xs font-medium sm:inline " +
              (i <= indiceAttuale ? "text-ink/80" : "text-ink/40")
            }
          >
            {p.label}
          </span>
          {i < passi.length - 1 && <div className="h-px w-4 shrink-0 bg-ink/15 sm:w-8" />}
        </div>
      ))}
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
