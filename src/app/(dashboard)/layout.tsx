import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">Radar Finanza</p>
              <p className="text-[11px] text-slate-400">MOLO 4.0</p>
            </div>
          </div>

          <SidebarNav />

          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-slate-700">{session?.user?.name}</p>
                <p className="truncate text-xs text-slate-400">{session?.user?.email}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
