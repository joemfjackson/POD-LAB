import { DIMENSION_META, SCORE_DIMENSIONS, type ScoreDimension } from "@/domain/scoring";
import { cn } from "./cn";

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, score * 10));
  return (
    <span className={cn("relative block h-1.5 w-full overflow-hidden rounded-full bg-accent/15", className)} aria-hidden>
      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function ScoreGrid({ scores, compact = false }: { scores: Array<{ dimension: string; score: number; explanation?: string }>; compact?: boolean }) {
  const byDim = new Map(scores.map((s) => [s.dimension, s]));
  return (
    <ul className={cn("grid gap-x-6", compact ? "grid-cols-2 gap-y-1.5" : "grid-cols-1 gap-y-3 md:grid-cols-2")}>
      {SCORE_DIMENSIONS.map((d: ScoreDimension) => {
        const s = byDim.get(d);
        return (
          <li key={d} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-ink-2">{DIMENSION_META[d].label}</span>
              <span className="font-mono text-ink tabular">{s ? Number(s.score).toFixed(1) : "—"}</span>
            </div>
            <ScoreBar score={s ? Number(s.score) : 0} className="mt-1" />
            {!compact && s?.explanation ? <p className="mt-1 text-xs text-muted">{s.explanation}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
