import Link from "next/link";
import { MissionForm } from "@/components/opportunities/mission-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfidenceChip, DemoBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/misc";
import { ScoreGrid } from "@/components/ui/score";
import { Time } from "@/components/ui/time";
import { getBrand } from "@/server/queries/brand";

export default async function BrandResearch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, brand } = await getBrand(id);
  const [opps, reports, missions] = await Promise.all([
    ctx.db.from("opportunities").select("id, code, niche, status, confidence, summary, research_mode, is_demo, researched_at, opportunity_scores(dimension, score, explanation)").eq("brand_id", id),
    ctx.db.from("research_reports").select("id, title, research_mode, created_at, opportunity_id, is_demo").eq("brand_id", id).order("created_at", { ascending: false }),
    ctx.db.from("research_missions").select("id, code, title, status, created_at").eq("brand_id", id).order("created_at", { ascending: false }),
  ]);
  const hypotheses = brand.hypotheses as Record<string, unknown>;
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        {(opps.data ?? []).map((o) => (
          <Card key={o.id}>
            <CardHeader
              title={
                <Link href={`/opportunities/${o.id}`} className="hover:text-accent">
                  {o.code} · {o.niche}
                </Link>
              }
              description={o.summary}
              actions={
                <>
                  <StatusChip status={o.status} />
                  <ConfidenceChip level={o.confidence} />
                  <DemoBadge show={o.is_demo} />
                </>
              }
            />
            <CardBody>
              <ScoreGrid scores={o.opportunity_scores.map((s) => ({ ...s, score: Number(s.score) }))} />
              <p className="mt-3 text-xs text-muted">
                Researched <Time value={o.researched_at} /> · mode {o.research_mode} ·{" "}
                <Link href={`/opportunities/${o.id}`} className="text-accent">
                  full report & sources →
                </Link>
              </p>
            </CardBody>
          </Card>
        ))}
        {!opps.data?.length ? <EmptyState title="No research linked yet" description="Run the Opportunity Scout on this brand to produce a scored research report." /> : null}
      </div>
      <div className="space-y-5">
        {hypotheses && Object.keys(hypotheses).length ? (
          <Card>
            <CardHeader title="Early hypotheses" description="Stored as hypotheses only — to be tested by agents and humans." />
            <CardBody className="space-y-2 text-xs text-ink-2">
              {Object.entries(hypotheses).map(([k, v]) => (
                <p key={k}>
                  <span className="text-muted">{k.replace(/_/g, " ")}: </span>
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </p>
              ))}
            </CardBody>
          </Card>
        ) : null}
        {ctx.role !== "viewer" ? (
          <Card>
            <CardHeader title="New research mission for this brand" />
            <CardBody>
              <Notice tone="info">Investigation missions update this brand&apos;s linked opportunity.</Notice>
              <div className="mt-3">
                <MissionForm maxCandidates={ctx.workspace.max_candidates} maxDepth={ctx.workspace.max_research_depth} brandId={brand.id} defaultPrompt={brand.niche} />
              </div>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Reports & missions" />
          <CardBody>
            <ul className="space-y-1.5 text-xs">
              {(reports.data ?? []).map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">{r.title}</span>
                  <span className="shrink-0 text-muted">
                    {r.research_mode} · <Time value={r.created_at} />
                  </span>
                </li>
              ))}
              {(missions.data ?? []).map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">
                    {m.code} {m.title}
                  </span>
                  <StatusChip status={m.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
