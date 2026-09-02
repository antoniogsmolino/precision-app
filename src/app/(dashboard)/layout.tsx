import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { type StatTilesDati } from "@/components/dashboard/stat-tiles";
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
    //
    // Niente `max-w` qui: su schermi grandi lo shell riempiva solo una
    // fetta centrale e il resto restava vuoto ("sembra inserito in una
    // cornice", feedback del team) — ora usa tutta la larghezza
    // disponibile, con solo un margine minimo (md:p-2.5) per far respirare
    // gli angoli arrotondati.
    <div className="min-h-screen bg-surface-alt md:flex md:min-h-screen md:items-center md:justify-center md:p-2.5">
      <MobileNav nome={session?.user?.name} email={session?.user?.email} />

      <div className="flex w-full flex-col md:h-[calc(100vh-20px)] md:flex-row md:overflow-hidden md:rounded-[28px] md:bg-white md:shadow-[0_6px_24px_rgb(43_46_52_/_10%)]">
        {/*
          Sidebar desktop: un solo componente con stato espanso (default) e
          collassato (solo icone) — prima erano due rail scure sempre
          visibili fianco a fianco con la stessa navigazione e lo stesso
          logo duplicati (feedback del team). Dentro lo shell a altezza
          fissa: la sidebar e il main scorrono in modo indipendente (§51
          della specifica), niente più `h-screen`/`sticky` globali.
        */}
        <aside className="hidden shrink-0 md:flex">
          <Sidebar nome={session?.user?.name} email={session?.user?.email} statTiles={statTiles} />
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
