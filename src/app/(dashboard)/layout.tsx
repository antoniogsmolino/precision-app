import { getServerSession } from "next-auth";
import Image from "next/image";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { IconRail } from "@/components/dashboard/icon-rail";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { StatTiles, type StatTilesDati } from "@/components/dashboard/stat-tiles";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";

async function caricaStatTiles(): Promise<StatTilesDati> {
  const ora = new Date();
  const tra30Giorni = new Date(ora.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [misureAperte, inScadenza, prospectTotali, matchDaLavorare] = await Promise.all([
    prisma.misura.count({ where: { dataApertura: { lte: ora }, dataScadenza: { gte: ora } } }),
    prisma.misura.count({
      where: { scadenzaStimata: false, dataApertura: { lte: ora }, dataScadenza: { gte: ora, lte: tra30Giorni } },
    }),
    prisma.prospect.count(),
    prisma.prospectMisuraMatch.count({ where: { statoPratica: "CANDIDATA" } }),
  ]);

  return { misureAperte, inScadenza, prospectTotali, matchDaLavorare };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, statTiles] = await Promise.all([getServerSession(authOptions), caricaStatTiles()]);

  return (
    // "App shell": su desktop l'intera dashboard vive dentro un'unica
    // superficie flottante con angoli molto arrotondati (specifica UI
    // fornita dal team, §5/§57: "grande superficie unica con angoli
    // arrotondati", non un semplice browser frame). Su mobile NIENTE shell
    // (§50 della specifica): pagina piena, senza margine né radius — lo
    // stesso pattern che questa dashboard già usava.
    <div className="min-h-screen bg-surface-alt md:flex md:min-h-screen md:items-center md:justify-center md:p-4">
      <MobileNav nome={session?.user?.name} email={session?.user?.email} />

      <div className="flex w-full flex-col md:h-[calc(100vh-32px)] md:max-w-[1520px] md:flex-row md:overflow-hidden md:rounded-[28px] md:bg-white md:shadow-[0_6px_24px_rgb(43_46_52_/_10%)]">
        {/*
          Sidebar desktop a DUE rail scure (rail icone strettissima +
          pannello statistiche/navigazione) — struttura da reference CRM,
          ricolorata sulla palette MOLO reale. Dentro lo shell a altezza
          fissa: ognuna delle due colonne scorre in modo indipendente
          (§51 della specifica), niente più `h-screen`/`sticky` globali.
        */}
        <aside className="hidden shrink-0 md:flex">
          <IconRail nome={session?.user?.name} />

          <div className="flex w-[280px] flex-col overflow-y-auto border-r border-white/[0.06] bg-ink/95">
            <div className="p-4">
              {/* Logo per intero (non solo il marchio) — su un fondo
                  bianco: il lettering "Sonar 4.0" è in ink scuro, sul
                  fondo ink del pannello risulterebbe illeggibile senza
                  questo. Nessun sottotitolo: il team ha chiesto di
                  toglierlo, il logo basta da solo. */}
              <div className="flex items-center justify-center rounded-2xl bg-white px-4 py-3.5">
                <Image src="/logo-full.png" alt="Sonar 4.0" width={1600} height={380} className="h-7 w-auto" priority />
              </div>
            </div>

            <StatTiles dati={statTiles} />

            <div className="mt-5 border-t border-white/[0.06] pt-3">
              <SidebarNav tono="scuro" />
            </div>

            <div className="mt-auto border-t border-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white/80">{session?.user?.name}</p>
                  <p className="truncate text-xs text-white/40">{session?.user?.email}</p>
                </div>
                <SignOutButton tono="scuro" />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
