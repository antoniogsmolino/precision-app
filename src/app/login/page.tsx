"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setCaricamento(false);
    if (res?.error) {
      setErrore("Email o password non corrette.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/60 to-slate-50 px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-600/25">
            M
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Radar Finanza Agevolata</h1>
          <p className="mt-1 text-sm text-slate-400">Accesso riservato al team MOLO 4.0</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@molo4punto0.it"
            />
          </div>
          <div className="mb-5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {errore && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 animate-fade-in">
              {errore}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={caricamento}>
            {caricamento ? "Accesso in corso…" : "Accedi"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Il matching mostrato in dashboard è sempre indicativo e non garantisce l&apos;ammissione ad alcuna misura.
        </p>
      </div>
    </div>
  );
}
