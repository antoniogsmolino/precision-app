import { getServerSession } from "next-auth";
import Image from "next/image";
import { authOptions } from "@/lib/auth/options";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-surface-alt">
      <MobileNav nome={session?.user?.name} email={session?.user?.email} />

      <div className="flex">
        <aside className="glass-surface-solid sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink/[0.06] md:flex">
          <div className="px-5 py-5">
            <Image src="/logo-full.png" alt="Sonar 4.0" width={1600} height={380} className="h-7 w-auto" priority />
            <p className="mt-1.5 text-[11px] text-ink/40">Radar Finanza Agevolata · MOLO</p>
          </div>

          <SidebarNav />

          <div className="mt-auto border-t border-ink/[0.06] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink/80">{session?.user?.name}</p>
                <p className="truncate text-xs text-ink/40">{session?.user?.email}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
