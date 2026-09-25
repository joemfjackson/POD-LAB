import type { Metadata } from "next";
import { MissionForm } from "@/components/opportunities/mission-form";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ScoreBar } from "@/components/ui/score";
import { Tabs } from "@/components/ui/tabs";
import { Time } from "@/components/ui/time";
import { setTrendStatusAction } from "@/server/actions/knowledge";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Trends" };

const VIEWS = ["new", "watching", "sent_to_scout", "dismissed"] as const;

export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const status = VIEWS.includes(sp.status as (typeof VIEWS)[number]) ? (sp.status as (typeof VIEWS)[number]) : "new";
  const trends = await ctx.db.from("trends").select("*, research_sources(id, source_url, source_title, claim, evidence_kind)").eq("workspace_id", ctx.workspace.id).eq("status", status).order("detected_at", { ascending: false });
  const canEdit = ctx.role !== "viewer";
  return (
    <>
      <PageHeader
        title="Trends"
        description="Emerging terms, communities, aesthetics and seasonal moments detected by the Trend Watcher. Promising trends feed the Opportunity Scout."
        actions={canEdit ? <RunAgentButton agent="trend_watcher" label="Run Trend Watcher" variant="primary" size="md" /> : null}
      />
      <Tabs label="Trend status" items={VIEWS.map((v) => ({ label: v.replace(/_/g, " "), href: `/trends?status=${v}`, active: v === status }))} />
      {trends.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {trends.data.map((t) => (
            <Card key={t.id}>
              <CardHeader
                title={`${t.code} · ${t.name}`}
                description={<>Detected <Time value={t.detected_at} /> · {t.research_mode}</>}
                actions={
                  <>
                    <Badge>{t.category.replace(/_/g, " ")}</Badge>
                    <DemoBadge show={t.is_demo} />
                  </>
                }
              />
              <CardBody className="space-y-3">
                <p className="text-sm whitespace-pre-line text-ink-2">{t.summary}</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted">Velocity</p>
                    <StatusChip status={t.velocity === "unknown" ? "unknown" : "active"} label={t.velocity} />
                  </div>
                  <div>
                    <p className="text-muted">Est. lifespan</p>
                    <p className="text-ink">{t.estimated_lifespan.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-muted">POD relevance {t.pod_relevance ?? "—"}/10</p>
                    <ScoreBar score={Number(t.pod_relevance ?? 0)} className="mt-1.5" />
                  </div>
                </div>
                <p className="text-xs text-ink-2">
                  <span className="text-muted">Recommended action: </span>
                  {t.recommended_action}
                </p>
                <ul className="space-y-1 text-[11px] text-muted">
                  {t.research_sources.map((s) => (
                    <li key={s.id}>
                      [{s.evidence_kind.replace(/_/g, " ")}] {s.claim}{" "}
                      {s.source_url ? (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent">
                          {s.source_title ?? "source"}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                    <Dialog trigger="Send to Opportunity Scout" title={`Research: ${t.name}`} triggerSize="sm">
                      <MissionForm maxCandidates={ctx.workspace.max_candidates} maxDepth={ctx.workspace.max_research_depth} trendId={t.id} defaultPrompt={t.name} />
                    </Dialog>
                    {t.status !== "watching" ? <ActionForm action={setTrendStatusAction} submitLabel="Watch" size="sm" variant="secondary" hidden={{ trend_id: t.id, status: "watching" }} inline /> : null}
                    {t.status !== "dismissed" ? <ActionForm action={setTrendStatusAction} submitLabel="Dismiss" size="sm" variant="ghost" hidden={{ trend_id: t.id, status: "dismissed" }} inline /> : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${status.replace(/_/g, " ")} trends`} description="Run the Trend Watcher to scan for emerging opportunities." />
      )}
    </>
  );
}
