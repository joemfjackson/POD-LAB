"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { NAV_GROUPS } from "./nav-items";

export function SidebarNav({ pendingApprovals, onNavigate }: { pendingApprovals: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-muted uppercase">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon aria-hidden className={cn("h-4 w-4", active ? "text-accent" : "text-muted")} />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/approvals" && pendingApprovals > 0 ? (
                      <span className="rounded bg-warning/15 px-1.5 text-[10px] font-semibold text-warning tabular" aria-label={`${pendingApprovals} pending`}>
                        {pendingApprovals}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
