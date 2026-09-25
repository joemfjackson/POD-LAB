import Link from "next/link";
import { PIPELINE_STAGES, STAGE_LABELS, type BrandStage } from "@/domain/lifecycle";
import { cn } from "@/components/ui/cn";

/** Stage pipeline: one tile per forward stage with its brand count. */
export function PipelineStrip({ counts }: { counts: Partial<Record<BrandStage, number>> }) {
  const max = Math.max(1, ...PIPELINE_STAGES.map((s) => counts[s] ?? 0));
  return (
    <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12" aria-label="Brand pipeline by stage">
      {PIPELINE_STAGES.map((s, i) => {
        const n = counts[s] ?? 0;
        return (
          <li key={s}>
            <Link
              href={`/brands?stage=${s}`}
              className={cn("block rounded-md border px-2 py-2 transition-colors hover:border-line-strong", n > 0 ? "border-line bg-surface-2" : "border-line/60 bg-transparent")}
            >
              <p className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</p>
              <p className="truncate text-[11px] text-ink-2" title={STAGE_LABELS[s]}>
                {STAGE_LABELS[s]}
              </p>
              <p className={cn("mt-1 text-lg font-semibold tabular", n > 0 ? "text-ink" : "text-muted")}>{n}</p>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-accent/10" aria-hidden>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
