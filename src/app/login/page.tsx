"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CardGlass } from "@/components/ui/card";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      {/* Sfondo: blob di colore sfocati che respirano lentamente, stile hero Apple */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] animate-float rounded-full bg-brand-600/40 blur-[110px]" />
        <div
          className="absolute -bottom-40 -right-24 h-[36rem] w-[36rem] animate-float rounded-full bg-navigation-500/30 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute left-1/3 top-1/4 h-72 w-72 animate-float rounded-full bg-growth-500/20 blur-[100px]"
          style={{ animationDelay: "-11s" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-ink/60" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 animate-rise-in text-center" style={{ animationDelay: "0.05s" }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2.5 shadow-glow">
            <Image src="/logo-icon.png" alt="Sonar 4.0" width={512} height={512} className="h-full w-full" priority />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sonar 4.0</h1>
          <p className="mt-1.5 text-sm text-white/50">Radar Finanza Agevolata — accesso riservato al team MOLO</p>
        </div>

        <CardGlass className="animate-rise-in p-6" style={{ animationDelay: "0.12s" }}>
          <form onSubmit={handleSubmit}>
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
                className="bg-white/80"
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
                className="bg-white/80"
              />
            </div>

            {errore && (
              <p className="mb-4 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 animate-fade-in">
                {errore}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={caricamento}>
              {caricamento ? "Accesso in corso…" : "Accedi"}
            </Button>
          </form>
        </CardGlass>

        <p
          className="mt-6 animate-rise-in text-center text-xs text-white/40"
          style={{ animationDelay: "0.18s" }}
        >
          Il matching mostrato in dashboard è sempre indicativo e non garantisce l&apos;ammissione ad alcuna misura.
        </p>
      </div>
    </div>
  );
}
