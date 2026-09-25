import Link from "next/link";
import { cn } from "./cn";

export interface TabItem {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/** Link-based tabs (server rendered; each tab is a real URL). */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                t.active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
              {t.count !== undefined ? <span className="rounded bg-surface-2 px-1 text-[10px] text-muted tabular">{t.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
