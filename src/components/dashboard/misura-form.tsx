"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/input";
import { TagListInput } from "@/components/dashboard/tag-list-input";
import { ITALIA_REGIONI } from "@/lib/validation/misura";
import { CATEGORIA_LABEL, TIPO_AGEVOLAZIONE_LABEL } from "@/lib/misure/valore";

type TipoValore = "IMPORTO_FISSO" | "RANGE" | "PERCENTUALE";

export interface MisuraFormValues {
  titolo: string;
  ente: string;
  categoria: string;
  descrizioneBreve: string;
  descrizioneEstesa: string;
  tipoAgevolazione: string;
  tipoValore: TipoValore;
  importoFisso: string;
  importoMin: string;
  importoMax: string;
  percentuale: string;
  tettoMassimo: string;
  dataApertura: string;
  dataScadenza: string;
  atecoAmmessi: string[];
  atecoEsclusi: string[];
  regioniAmmesse: string[];
  fatturatoMin: string;
  fatturatoMax: string;
  dipendentiMin: string;
  dipendentiMax: string;
  altriRequisiti: string;
  documentiRichiesti: string[];
  linkFonteUfficiale: string;
  noteInterne: string;
  cumulabiliIds: string[];
}

const VALORI_INIZIALI: MisuraFormValues = {
  titolo: "",
  ente: "",
  categoria: "NAZIONALE",
  descrizioneBreve: "",
  descrizioneEstesa: "",
  tipoAgevolazione: "FONDO_PERDUTO",
  tipoValore: "IMPORTO_FISSO",
  importoFisso: "",
  importoMin: "",
  importoMax: "",
  percentuale: "",
  tettoMassimo: "",
  dataApertura: "",
  dataScadenza: "",
  atecoAmmessi: [],
  atecoEsclusi: [],
  regioniAmmesse: [],
  fatturatoMin: "",
  fatturatoMax: "",
  dipendentiMin: "",
  dipendentiMax: "",
  altriRequisiti: "",
  documentiRichiesti: [],
  linkFonteUfficiale: "",
  noteInterne: "",
  cumulabiliIds: [],
};

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function MisuraForm({
  misuraId,
  valoriIniziali,
}: {
  misuraId?: string;
  valoriIniziali?: Partial<MisuraFormValues>;
}) {
  const router = useRouter();
  const [valori, setValori] = useState<MisuraFormValues>({ ...VALORI_INIZIALI, ...valoriIniziali });
  const [misureDisponibili, setMisureDisponibili] = useState<{ id: string; titolo: string }[]>([]);
  const [ricercaCumulabili, setRicercaCumulabili] = useState("");
  const [errori, setErrori] = useState<string[]>([]);
  const [salvataggio, setSalvataggio] = useState(false);

  useEffect(() => {
    fetch("/api/misure")
      .then((r) => r.json())
      .then((m: { id: string; titolo: string }[]) => setMisureDisponibili(m.filter((x) => x.id !== misuraId)))
      .catch(() => setMisureDisponibili([]));
  }, [misuraId]);

  function set<K extends keyof MisuraFormValues>(chiave: K, valore: MisuraFormValues[K]) {
    setValori((v) => ({ ...v, [chiave]: valore }));
  }

  const misureFiltrate = useMemo(
    () =>
      misureDisponibili.filter((m) => m.titolo.toLowerCase().includes(ricercaCumulabili.toLowerCase())),
    [misureDisponibili, ricercaCumulabili],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrori([]);
    setSalvataggio(true);

    const payload = {
      titolo: valori.titolo,
      ente: valori.ente,
      categoria: valori.categoria,
      descrizioneBreve: valori.descrizioneBreve,
      descrizioneEstesa: valori.descrizioneEstesa,
      tipoAgevolazione: valori.tipoAgevolazione,
      tipoValore: valori.tipoValore,
      importoFisso: valori.tipoValore === "IMPORTO_FISSO" ? numOrNull(valori.importoFisso) : null,
      importoMin: valori.tipoValore === "RANGE" ? numOrNull(valori.importoMin) : null,
      importoMax: valori.tipoValore === "RANGE" ? numOrNull(valori.importoMax) : null,
      percentuale: valori.tipoValore === "PERCENTUALE" ? numOrNull(valori.percentuale) : null,
      tettoMassimo: valori.tipoValore === "PERCENTUALE" ? numOrNull(valori.tettoMassimo) : null,
      dataApertura: valori.dataApertura,
      dataScadenza: valori.dataScadenza,
      atecoAmmessi: valori.atecoAmmessi,
      atecoEsclusi: valori.atecoEsclusi,
      regioniAmmesse: valori.regioniAmmesse,
      fatturatoMin: numOrNull(valori.fatturatoMin),
      fatturatoMax: numOrNull(valori.fatturatoMax),
      dipendentiMin: numOrNull(valori.dipendentiMin),
      dipendentiMax: numOrNull(valori.dipendentiMax),
      altriRequisiti: valori.altriRequisiti || null,
      documentiRichiesti: valori.documentiRichiesti,
      linkFonteUfficiale: valori.linkFonteUfficiale,
      noteInterne: valori.noteInterne || null,
      cumulabiliIds: valori.cumulabiliIds,
    };

    const res = await fetch(misuraId ? `/api/misure/${misuraId}` : "/api/misure", {
      method: misuraId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSalvataggio(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const messaggi: string[] = data?.errori?.formErrors?.length
        ? data.errori.formErrors
        : data?.errori?.fieldErrors
          ? Object.entries(data.errori.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`)
          : ["Errore nel salvataggio. Controlla i campi obbligatori."];
      setErrori(messaggi);
      return;
    }

    const salvata = await res.json();
    router.push(`/misure/${salvata.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errori.length > 0 && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <ul className="list-inside list-disc">
            {errori.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardBody className="pt-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
            Informazioni generali
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Titolo" required>
              <Input value={valori.titolo} onChange={(e) => set("titolo", e.target.value)} required />
            </Field>
            <Field label="Ente erogatore" required>
              <Input value={valori.ente} onChange={(e) => set("ente", e.target.value)} required />
            </Field>
            <Field label="Categoria" required>
              <Select value={valori.categoria} onChange={(e) => set("categoria", e.target.value)}>
                {Object.entries(CATEGORIA_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo agevolazione" required>
              <Select value={valori.tipoAgevolazione} onChange={(e) => set("tipoAgevolazione", e.target.value)}>
                {Object.entries(TIPO_AGEVOLAZIONE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Descrizione breve" required>
              <Input value={valori.descrizioneBreve} onChange={(e) => set("descrizioneBreve", e.target.value)} required />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Descrizione estesa" required>
              <Textarea value={valori.descrizioneEstesa} onChange={(e) => set("descrizioneEstesa", e.target.value)} required />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Valore economico</h2>
          <Field label="Forma del valore" required>
            <Select value={valori.tipoValore} onChange={(e) => set("tipoValore", e.target.value as TipoValore)}>
              <option value="IMPORTO_FISSO">Importo fisso</option>
              <option value="RANGE">Range (min–max)</option>
              <option value="PERCENTUALE">Percentuale (con eventuale tetto)</option>
            </Select>
          </Field>

          {valori.tipoValore === "IMPORTO_FISSO" && (
            <div className="mt-4">
              <Field label="Importo (€)">
                <Input type="number" min={0} value={valori.importoFisso} onChange={(e) => set("importoFisso", e.target.value)} />
              </Field>
            </div>
          )}
          {valori.tipoValore === "RANGE" && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Importo minimo (€)">
                <Input type="number" min={0} value={valori.importoMin} onChange={(e) => set("importoMin", e.target.value)} />
              </Field>
              <Field label="Importo massimo (€)">
                <Input type="number" min={0} value={valori.importoMax} onChange={(e) => set("importoMax", e.target.value)} />
              </Field>
            </div>
          )}
          {valori.tipoValore === "PERCENTUALE" && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Percentuale (%)">
                <Input type="number" min={0} max={100} value={valori.percentuale} onChange={(e) => set("percentuale", e.target.value)} />
              </Field>
              <Field label="Tetto massimo (€)">
                <Input type="number" min={0} value={valori.tettoMassimo} onChange={(e) => set("tettoMassimo", e.target.value)} />
              </Field>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Data apertura" required>
              <Input type="date" value={valori.dataApertura} onChange={(e) => set("dataApertura", e.target.value)} required />
            </Field>
            <Field label="Data scadenza" required>
              <Input type="date" value={valori.dataScadenza} onChange={(e) => set("dataScadenza", e.target.value)} required />
            </Field>
          </div>
          <FieldHint>Lo stato (Futura/Attiva/In scadenza/Scaduta) viene calcolato automaticamente da queste date.</FieldHint>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
            Requisiti di ammissibilità
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ATECO ammessi">
              <TagListInput values={valori.atecoAmmessi} onChange={(v) => set("atecoAmmessi", v)} placeholder="es. 62, 63.11…" />
            </Field>
            <Field label="ATECO esclusi">
              <TagListInput values={valori.atecoEsclusi} onChange={(v) => set("atecoEsclusi", v)} placeholder="es. 64, 65…" />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Regioni ammesse (vuoto = tutte)">
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
                {ITALIA_REGIONI.map((r) => {
                  const attiva = valori.regioniAmmesse.includes(r);
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() =>
                        set(
                          "regioniAmmesse",
                          attiva ? valori.regioniAmmesse.filter((x) => x !== r) : [...valori.regioniAmmesse, r],
                        )
                      }
                      className={
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                        (attiva
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")
                      }
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="Fatturato minimo (€)">
              <Input type="number" min={0} value={valori.fatturatoMin} onChange={(e) => set("fatturatoMin", e.target.value)} />
            </Field>
            <Field label="Fatturato massimo (€)">
              <Input type="number" min={0} value={valori.fatturatoMax} onChange={(e) => set("fatturatoMax", e.target.value)} />
            </Field>
            <Field label="Dipendenti minimo">
              <Input type="number" min={0} value={valori.dipendentiMin} onChange={(e) => set("dipendentiMin", e.target.value)} />
            </Field>
            <Field label="Dipendenti massimo">
              <Input type="number" min={0} value={valori.dipendentiMax} onChange={(e) => set("dipendentiMax", e.target.value)} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Altri requisiti (testo libero)">
              <Textarea value={valori.altriRequisiti} onChange={(e) => set("altriRequisiti", e.target.value)} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
            Documenti, fonte e cumulabilità
          </h2>
          <Field label="Documenti richiesti (checklist)">
            <TagListInput
              values={valori.documentiRichiesti}
              onChange={(v) => set("documentiRichiesti", v)}
              placeholder="es. Visura camerale…"
            />
          </Field>

          <div className="mt-4">
            <Field label="Link fonte ufficiale" required>
              <Input
                type="url"
                placeholder="https://…"
                value={valori.linkFonteUfficiale}
                onChange={(e) => set("linkFonteUfficiale", e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Misure cumulabili">
              <Input
                placeholder="Cerca una misura…"
                value={ricercaCumulabili}
                onChange={(e) => setRicercaCumulabili(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                {misureFiltrate.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">Nessuna misura trovata</p>
                )}
                {misureFiltrate.map((m) => {
                  const attiva = valori.cumulabiliIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-2 text-[13px] last:border-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                        checked={attiva}
                        onChange={() =>
                          set(
                            "cumulabiliIds",
                            attiva ? valori.cumulabiliIds.filter((x) => x !== m.id) : [...valori.cumulabiliIds, m.id],
                          )
                        }
                      />
                      {m.titolo}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Note interne">
              <Textarea
                value={valori.noteInterne}
                onChange={(e) => set("noteInterne", e.target.value)}
                placeholder="Visibili solo al team MOLO"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2 pb-8">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button type="submit" disabled={salvataggio}>
          {salvataggio ? "Salvataggio…" : misuraId ? "Salva modifiche" : "Crea misura"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}
