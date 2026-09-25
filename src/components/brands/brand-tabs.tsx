"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/components/ui/cn";

export const BRAND_TABS = [
  { segment: null, label: "Overview" },
  { segment: "research", label: "Research" },
  { segment: "identity", label: "Identity" },
  { segment: "names", label: "Names" },
  { segment: "collections", label: "Collections" },
  { segment: "designs", label: "Designs" },
  { segment: "products", label: "Products" },
  { segment: "store", label: "Store" },
  { segment: "growth", label: "Growth" },
  { segment: "experiments", label: "Experiments" },
  { segment: "financials", label: "Financials" },
  { segment: "history", label: "Agent History" },
  { segment: "files", label: "Files" },
  { segment: "notes", label: "Notes" },
] as const;

export function BrandTabs({ brandId }: { brandId: string }) {
  const segment = useSelectedLayoutSegment();
  return (
    <nav aria-label="Brand sections" className="mb-5 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-1">
        {BRAND_TABS.map((t) => {
          const active = segment === t.segment;
          return (
            <li key={t.label}>
              <Link
                href={t.segment ? `/brands/${brandId}/${t.segment}` : `/brands/${brandId}`}
                aria-current={active ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2 text-sm whitespace-nowrap", active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
