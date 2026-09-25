"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const TABS = [
  { href: "/settings", label: "Workspace" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/ai", label: "AI provider" },
  { href: "/settings/agents", label: "Agents" },
  { href: "/settings/providers", label: "Providers & credentials" },
  { href: "/settings/rules", label: "Decision rules & pricing" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-5 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm", active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
