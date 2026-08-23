"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { CATEGORIA_LABEL } from "@/lib/misure/valore";

interface MisuraRisultato {
  id: string;
  titolo: string;
  ente: string;
  categoria: string;
  descrizioneBreve: string;
  valoreFormattato: string;
  scadenzaFormattata: string;
  scadenzaStimata: boolean;
  linkFonteUfficiale: string;
}

interface RispostaMatch {
  azienda: { ragioneSociale: string; ateco: string | null; regione: string | null };
  misure: MisuraRisultato[];
  emailInviata: boolean;
  contatti: { telefono: string | null; bookingUrl: string | null };
}

type Stato = { fase: "form" } | { fase: "caricamento" } | { fase: "errore"; messaggio: string } | { fase: "risultato"; dati: RispostaMatch };

function formattaPiva(v: string): string {
  return v.replace(/\D/g, "").slice(0, 11);
}

export function MatchClient() {
  const [stato, setStato] = useState<Stato>({ fase: "form" });
  const [piva, setPiva] = useState("");
  const [email, setEmail] = useState("");
  const [consenso, setConsenso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStato({ fase: "caricamento" });

    try {
      const res = await fetch("/api/pubblico/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piva, email }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStato({ fase: "errore", messaggio: json.errore ?? "Qualcosa non ha funzionato. Riprova." });
        return;
      }

      setStato({ fase: "risultato", dati: json });
    } catch {
      setStato({ fase: "errore", messaggio: "Non riusciamo a contattare il server. Controlla la connessione e riprova." });
    }
  }

  function nuovaRicerca() {
    setStato({ fase: "form" });
    setPiva("");
    setEmail("");
    setConsenso(false);
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Hero */}
      <div className="relative overflow-hidden bg-ink px-4 pb-20 pt-14 sm:pb-28 sm:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] animate-float rounded-full bg-brand-600/35 blur-[110px]" />
          <div
            className="absolute -bottom-32 -right-20 h-[30rem] w-[30rem] animate-float rounded-full bg-navigation-500/25 blur-[110px]"
            style={{ animationDelay: "-6s" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-transparent to-ink/70" />
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mb-8 animate-rise-in">
            <div className="inline-flex rounded-2xl bg-white px-5 py-3 shadow-glow">
              <Image src="/molo-logo.png" alt="MOLO 4.0 — Impresa possibile" width={300} height={89} className="h-10 w-auto" priority />
            </div>
          </div>
          <h1 className="animate-rise-in text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ animationDelay: "0.05s" }}>
            Scopri in un minuto quali bandi e incentivi puoi richiedere
          </h1>
          <p className="mx-auto mt-4 max-w-lg animate-rise-in text-[15px] text-white/60" style={{ animationDelay: "0.1s" }}>
            Inserisci la Partita IVA della tua azienda: la confrontiamo con i bandi e gli incentivi attivi che monitoriamo ogni giorno da fonti ufficiali, gratis.
          </p>
        </div>
      </div>

      {/* Corpo: form o risultati, in una card che "sale" sopra l'hero */}
      <div className="relative mx-auto -mt-10 max-w-2xl px-4 pb-24 sm:-mt-14">
        {stato.fase === "form" && (
          <Card className="animate-rise-in p-6 sm:p-8">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <Label htmlFor="piva">Partita IVA</Label>
                <Input
                  id="piva"
                  inputMode="numeric"
                  required
                  value={piva}
                  onChange={(e) => setPiva(formattaPiva(e.target.value))}
                  placeholder="12345678901"
                  minLength={11}
                  maxLength={11}
                />
                <FieldHint>11 cifre, senza spazi né il prefisso IT.</FieldHint>
              </div>
              <div className="mb-5">
                <Label htmlFor="email">La tua email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                />
                <FieldHint>Ti mandiamo qui l&apos;elenco degli incentivi trovati.</FieldHint>
              </div>
              <label className="mb-5 flex items-start gap-2.5 text-[13px] text-ink/55">
                <input
                  type="checkbox"
                  required
                  checked={consenso}
                  onChange={(e) => setConsenso(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/20 text-brand-600 focus:ring-brand-300"
                />
                <span>
                  Acconsento al trattamento dei miei dati da parte di MOLO 4.0 per ricevere l&apos;elenco degli incentivi compatibili e, se lo desidero, essere ricontattato.
                </span>
              </label>
              <Button type="submit" size="lg" className="w-full" disabled={piva.length !== 11 || !consenso}>
                Trova i miei incentivi
              </Button>
            </form>
          </Card>
        )}

        {stato.fase === "caricamento" && (
          <div className="space-y-3">
            <Card className="animate-rise-in p-6 text-center sm:p-8">
              <p className="text-sm font-medium text-ink/70">Stiamo verificando la Partita IVA e confrontando i requisiti…</p>
            </Card>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {stato.fase === "errore" && (
          <Card className="animate-rise-in p-6 sm:p-8">
            <EmptyState title="Non siamo riusciti a completare la ricerca" description={stato.messaggio} />
            <Button variant="secondary" className="mt-2 w-full" onClick={nuovaRicerca}>
              Riprova
            </Button>
          </Card>
        )}

        {stato.fase === "risultato" && (
          <ResultatoView dati={stato.dati} onNuovaRicerca={nuovaRicerca} />
        )}
      </div>
    </div>
  );
}

function ResultatoView({ dati, onNuovaRicerca }: { dati: RispostaMatch; onNuovaRicerca: () => void }) {
  const { azienda, misure, emailInviata, contatti } = dati;

  return (
    <div className="space-y-4">
      <Card className="animate-rise-in p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/40">Risultato per</p>
        <p className="mt-0.5 text-lg font-bold text-ink">{azienda.ragioneSociale}</p>
        <p className="mt-1 text-sm text-ink/50">
          {[azienda.ateco && `ATECO ${azienda.ateco}`, azienda.regione].filter(Boolean).join(" · ") || "Dati anagrafici limitati"}
        </p>
        {emailInviata && (
          <p className="mt-3 text-[13px] text-growth-700">✓ Ti abbiamo anche mandato questo elenco via email.</p>
        )}
      </Card>

      {misure.length === 0 ? (
        <Card className="animate-rise-in p-6 sm:p-8">
          <EmptyState
            title="Nessuna misura compatibile al momento"
            description="In base ai dati disponibili non risultano bandi o incentivi attivi compatibili con la tua azienda in questo momento. Il nostro team aggiorna il monitoraggio ogni giorno: riprova tra qualche giorno o contattaci direttamente."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="animate-rise-in px-1 text-sm font-medium text-ink/60">
            {misure.length === 1 ? "1 misura compatibile" : `${misure.length} misure compatibili`}
          </p>
          {misure.map((m, i) => (
            <Card key={m.id} className="animate-rise-in p-5" style={{ animationDelay: `${0.05 * i}s` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Badge className="border-navigation-500/25 bg-navigation-50 text-navigation-700">
                    {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                  </Badge>
                  <p className="mt-2 text-base font-semibold text-ink">{m.titolo}</p>
                  <p className="mt-0.5 text-sm text-ink/50">{m.ente}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink/70">{m.descrizioneBreve}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-ink">{m.valoreFormattato}</span>
                <span className="text-ink/40">
                  {m.scadenzaStimata ? "Scadenza da verificare" : `Scadenza ${m.scadenzaFormattata}`}
                </span>
              </div>
              <a
                href={m.linkFonteUfficiale}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Vai alla fonte ufficiale →
              </a>
            </Card>
          ))}
        </div>
      )}

      {(contatti.telefono || contatti.bookingUrl) && (
        <Card className="animate-rise-in bg-ink p-6 text-center text-white sm:p-8">
          <p className="text-base font-semibold">Vuoi una mano a capire quali richiedere davvero?</p>
          <p className="mt-1.5 text-sm text-white/60">Il team MOLO 4.0 ti aiuta a valutare i requisiti e preparare la domanda.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {contatti.bookingUrl && (
              <Button onClick={() => window.open(contatti.bookingUrl!, "_blank")}>
                Prenota una consulenza gratuita
              </Button>
            )}
            {contatti.telefono && (
              <Button variant="glass" onClick={() => window.open(`tel:${contatti.telefono}`)}>
                Chiama {contatti.telefono}
              </Button>
            )}
          </div>
        </Card>
      )}

      <button onClick={onNuovaRicerca} className="mx-auto block text-sm font-medium text-ink/40 hover:text-ink/70">
        ← Cerca un&apos;altra Partita IVA
      </button>
    </div>
  );
}
