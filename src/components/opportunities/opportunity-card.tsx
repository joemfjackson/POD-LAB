import Link from "next/link";
import { ConfidenceChip, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ScoreGrid } from "@/components/ui/score";
import { formatDate } from "@/domain/format";
import { scoreProfile, type DimensionScore } from "@/domain/scoring";

export interface OpportunityCardData {
  id: string;
  code: string;
  niche: string;
  hypothesis: string | null;
  audience: string | null;
  summary: string | null;
  status: string;
  confidence: string | null;
  strongest_signal: string | null;
  biggest_risk: string | null;
  researched_at: string | null;
  research_mode: string | null;
  is_demo: boolean;
  opportunity_scores: Array<{ dimension: string; score: number }>;
}

const TIER_LABEL: Record<string, string> = { strong: "Strong", promising: "Promising", mixed: "Mixed", weak: "Weak", incomplete: "Incomplete" };

export function OpportunityCard({ o }: { o: OpportunityCardData }) {
  const profile = scoreProfile(o.opportunity_scores.map((s) => ({ ...s, score: Number(s.score), explanation: "" })) as DimensionScore[]);
  return (
    <article className="flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted">{o.code}</span>
        <StatusChip status={o.status} />
        <ConfidenceChip level={o.confidence} />
        <DemoBadge show={o.is_demo} />
      </div>
      <h3 className="text-sm font-semibold text-ink">
        <Link href={`/opportunities/${o.id}`} className="hover:text-accent">
          {o.niche}
        </Link>
      </h3>
      {o.hypothesis ? <p className="mt-1 line-clamp-2 text-xs text-ink-2">{o.hypothesis}</p> : null}
      {o.audience ? <p className="mt-1 line-clamp-1 text-xs text-muted">Audience: {o.audience}</p> : null}
      <div className="mt-3">
        <ScoreGrid scores={o.opportunity_scores.map((s) => ({ dimension: s.dimension, score: Number(s.score) }))} compact />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Profile: <span className="text-ink-2">{TIER_LABEL[profile.tier]}</span>
        {profile.blockingWeaknesses.length ? <span className="text-serious"> · blocking weakness</span> : null}
      </p>
      <dl className="mt-3 space-y-1 text-xs">
        <div>
          <dt className="inline text-muted">Strongest signal: </dt>
          <dd className="inline text-ink-2">{o.strongest_signal ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-muted">Biggest risk: </dt>
          <dd className="inline text-ink-2">{o.biggest_risk ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-auto pt-3 text-[11px] text-muted">
        Researched {formatDate(o.researched_at)} · {o.research_mode ?? "—"}
      </p>
    </article>
  );
}
