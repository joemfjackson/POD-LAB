import Link from "next/link";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export interface DesignCardData {
  id: string;
  code: string;
  title: string;
  concept: string;
  status: string;
  compliance_status: string;
  printing_method: string | null;
  preferred_products: string[];
  is_demo: boolean;
  collections?: { name: string } | null;
  brands?: { code: string } | null;
  thumbnail?: string | null;
}

export function DesignGrid({ designs, showBrand = false }: { designs: DesignCardData[]; showBrand?: boolean }) {
  if (!designs.length) return <EmptyState title="No design concepts" description="Run the Creative Director to create visual directions, collections and production briefs, or add a concept manually." />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {designs.map((d) => (
        <li key={d.id}>
          <Link href={`/design-studio/${d.id}`} className="flex h-full flex-col rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
            <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-t-lg border-b border-line bg-bg">
              {d.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
                <img src={d.thumbnail} alt={`${d.title} artwork`} className="h-full w-full object-cover" />
              ) : (
                <span className="px-4 text-center font-mono text-xs leading-relaxed tracking-wider text-ink-2 uppercase">{d.title}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <span className="font-mono text-[10px] text-muted">{d.code}</span>
                {showBrand && d.brands ? <span className="font-mono text-[10px] text-accent">{d.brands.code}</span> : null}
                <DemoBadge show={d.is_demo} />
              </div>
              <p className="text-sm font-medium text-ink">{d.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{d.concept}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-2">
                <StatusChip status={d.status} />
                <StatusChip status={d.compliance_status} label={`IP: ${d.compliance_status.replace("_", " ")}`} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                {d.collections?.name ?? "No collection"} · {d.printing_method ?? "method tbd"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
