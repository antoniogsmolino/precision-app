"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/** `scuro`: usato nel footer del secondo rail della sidebar desktop (fondo ink) — "ghost" normale sarebbe illeggibile lì. */
export function SignOutButton({ tono = "chiaro" }: { tono?: "chiaro" | "scuro" }) {
  return (
    <Button variant={tono === "scuro" ? "ghostInvert" : "ghost"} size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      Esci
    </Button>
  );
}
