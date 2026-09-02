import { getServerSession } from "next-auth";
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
    <div className="min-h-screen bg-surface-alt">
      <MobileNav nome={session?.user?.name} email={session?.user?.email} />

      <div className="flex">
        {/*
          Sidebar desktop a DUE rail scure, struttura ricalcata sulla
          reference CRM fornita dal team (rail icone strettissima +
          pannello contestuale con statistiche e navigazione), ricolorata
          sulla palette MOLO reale (ink/brand-600) invece del nero/lime
          della reference.
        */}
        <aside className="sticky top-0 hidden h-screen shrink-0 md:flex">
          <IconRail nome={session?.user?.name} />

          <div className="flex w-64 flex-col border-r border-white/[0.06] bg-ink/95">
            <div className="px-5 py-5">
              <p className="text-sm font-bold tracking-tight text-white">Sonar 4.0</p>
              <p className="mt-0.5 text-[11px] text-white/40">Radar Finanza Agevolata · MOLO</p>
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

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
