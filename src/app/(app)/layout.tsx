import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { CommandBar } from "@/components/layout/command-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { serverEnv } from "@/lib/env";
import { getContext } from "@/server/context";

// Agent runs triggered from server actions on these pages may call a model.
export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const [approvals, unread] = await Promise.all([
    ctx.db.from("approval_gates").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).eq("status", "pending"),
    ctx.db.from("notifications").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).is("read_at", null),
  ]);
  const pending = approvals.count ?? 0;
  const unreadCount = unread.count ?? 0;
  const demoAi = serverEnv().AI_PROVIDER === "demo" && !ctx.workspace.ai_provider;

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-accent-ink">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/dashboard" className="mb-5 flex items-center gap-2 px-2">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-[10px] font-bold text-accent-strong">
            PL
          </span>
          <span className="text-sm font-semibold">POD Lab</span>
        </Link>
        <SidebarNav pendingApprovals={pending} />
        <div className="mt-auto px-2 pt-6 text-[10px] text-muted">
          <p className="truncate">{ctx.workspace.name}</p>
          <p className="capitalize">{ctx.role}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur">
          <MobileNav pendingApprovals={pending} />
          <div className="min-w-0 flex-1">
            <CommandBar />
          </div>
          <WorkspaceSwitcher current={ctx.workspace.id} workspaces={ctx.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role }))} />
          <Link href="/notifications" className="relative grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2" aria-label={`Notifications (${unreadCount} unread)`}>
            <Bell className="h-4 w-4" aria-hidden />
            {unreadCount > 0 ? <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-bold text-accent-ink tabular">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2" aria-label={`Sign out ${ctx.user.email}`} title={`Sign out ${ctx.user.email}`}>
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </header>
        {demoAi ? (
          <div className="border-b border-warning/30 bg-warning/5 px-4 py-1.5 text-xs text-ink-2" role="note">
            <span className="font-semibold text-warning">Demo AI provider active.</span> Agent output is deterministic placeholder content with no model calls or live research — every record it creates is labelled DEMO.{" "}
            <Link href="/settings/ai" className="text-accent hover:underline">
              Configure an AI provider
            </Link>
          </div>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
