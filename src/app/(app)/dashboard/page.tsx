import type { Metadata } from "next";
import Link from "next/link";
import { computeDirectorStats, deterministicBriefing } from "@/agents/handlers/director";
import type { DirectorOutput } from "@/agents/schemas";
import { ColumnChart } from "@/components/charts/column-chart";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { PipelineStrip } from "@/components/shared/pipeline-strip";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import { formatInt, formatUsd } from "@/domain/format";
import { rangeStart } from "@/domain/financial-model";
import type { BrandStage } from "@/domain/lifecycle";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getContext();
  const ws = ctx.workspace.id;
  const db = ctx.db;
  const since30 = rangeStart("30d")!;

  const [stats, designs, stores, experiments, fin, fin30, activity, approvals, alerts, briefing] = await Promise.all([
    computeDirectorStats(db, ws),
    db.from("design_concepts").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "retired"),
    db.from("stores").select("id", { count: "exact", head: true }).eq("workspace_id", ws).in("status", ["live", "launch_approved"]),
    db.from("experiments").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "running"),
    db.from("financial_metrics").select("revenue, gross_profit, contribution_profit, is_demo").eq("workspace_id", ws),
    db.from("financial_metrics").select("metric_date, revenue").eq("workspace_id", ws).gte("metric_date", since30).order("metric_date"),
    db.from("audit_log").select("id, actor_type, agent_key, summary, created_at, brand_id, subject_type, subject_id").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(12),
    db.from("approval_gates").select("id, code, title, gate_type, created_at").eq("workspace_id", ws).eq("status", "pending").order("created_at").limit(6),
    db.from("notifications").select("id, title, severity, link, created_at").eq("workspace_id", ws).is("read_at", null).in("severity", ["warning", "critical"]).order("created_at", { ascending: false }).limit(5),
    db.from("agent_outputs").select("data, created_at").eq("workspace_id", ws).eq("agent_key", "director").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const finRows = fin.data ?? [];
  const totals = finRows.reduce(
    (a, r) => ({ revenue: a.revenue + Number(r.revenue), gross: a.gross + Number(r.gross_profit), contribution: a.contribution + Number(r.contribution_profit) }),
    { revenue: 0, gross: 0, contribution: 0 },
  );
  const finDemo = finRows.some((r) => r.is_demo);
  const byDay = new Map<string, number>();
  for (const r of fin30.data ?? []) byDay.set(r.metric_date, (byDay.get(r.metric_date) ?? 0) + Number(r.revenue));
  const chart = [...byDay.entries()].map(([d, v]) => ({ label: d.slice(5), value: v }));

  const sc = stats.stageCounts as Partial<Record<BrandStage, number>>;
  const inDevelopment = ["approved", "branding", "creative", "product_selection", "store_build", "launch_ready"].reduce((s, k) => s + (sc[k as BrandStage] ?? 0), 0);
  const opp = stats.opportunityCounts;
  const brief: DirectorOutput = (briefing.data?.data as DirectorOutput | undefined) ?? deterministicBriefing(stats);

  return (
    <>
      <PageHeader
        title="Command center"
        description={`${ctx.workspace.name} · Research → Validate → Brand → Design → Products → Store → Launch → Test → Analyze → Kill / Iterate / Clone / Scale`}
        actions={
          <>
            <ButtonLink href="/opportunities?new=1" variant="primary">
              New research mission
            </ButtonLink>
            <RunAgentButton agent="director" label="Run Director briefing" />
          </>
        }
      />

      <section aria-label="Key numbers" className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Opportunities discovered" value={formatInt(Object.values(opp).reduce((a, b) => a + b, 0))} href="/opportunities" />
        <StatTile label="Researching" value={formatInt((opp.researching ?? 0) + (opp.inbox ?? 0))} href="/opportunities?view=researching" />
        <StatTile label="Approved opportunities" value={formatInt(opp.approved ?? 0)} href="/opportunities?view=approved" />
        <StatTile label="Brands in development" value={formatInt(inDevelopment)} href="/brands" />
        <StatTile label="Brands testing" value={formatInt((sc.testing ?? 0) + (sc.iterating ?? 0))} href="/brands?stage=testing" />
        <StatTile label="Brands scaling" value={formatInt(sc.scaling ?? 0)} href="/brands?stage=scaling" />
        <StatTile label="Brands killed" value={formatInt(sc.killed ?? 0)} href="/brands?stage=killed" />
        <StatTile label="Active agent jobs" value={formatInt(stats.activeJobs)} href="/agents" />
        <StatTile label="Design concepts" value={formatInt(designs.count ?? 0)} href="/design-studio" />
        <StatTile label="Live / launch-approved stores" value={formatInt(stores.count ?? 0)} href="/stores" />
        <StatTile label="Active experiments" value={formatInt(experiments.count ?? 0)} href="/experiments?status=running" />
        <StatTile label="Pending approvals" value={formatInt(stats.pendingApprovals.length)} href="/approvals" tone={stats.pendingApprovals.length ? "accent" : "default"} />
      </section>

      <Card className="mb-5">
        <CardHeader title="Stage pipeline" description="Brands by lifecycle stage. Gated transitions require human approval." />
        <CardBody>
          <PipelineStrip counts={sc} />
          <p className="mt-2 text-xs text-muted">
            Paused {sc.paused ?? 0} · Killed {sc.killed ?? 0} · Archived {sc.archived ?? 0}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Portfolio financials"
              description="Gross profit and contribution profit are not net income — fixed overhead is excluded."
              actions={<DemoBadge show={finDemo} />}
            />
            <CardBody>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted">Revenue (all time)</p>
                  <p className="text-xl font-semibold tabular">{formatUsd(totals.revenue, { compact: true })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Gross profit</p>
                  <p className="text-xl font-semibold tabular">{formatUsd(totals.gross, { compact: true })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Contribution profit</p>
                  <p className="text-xl font-semibold tabular">{formatUsd(totals.contribution, { compact: true })}</p>
                </div>
              </div>
              {chart.length ? (
                <>
                  <p className="mb-1 text-xs text-muted">Daily revenue, last 30 days</p>
                  <ColumnChart data={chart} ariaLabel="Daily revenue, last 30 days" valueFormat="usd_compact" />
                </>
              ) : (
                <EmptyState title="No financial data yet" description="Import orders (CSV) or connect a store to see revenue and profit." action={<ButtonLink href="/imports?kind=orders" size="sm">Import orders</ButtonLink>} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Director briefing"
              description={briefing.data ? <>Latest Director run · <Time value={briefing.data.created_at} /></> : "Computed live from workspace data"}
            />
            <CardBody className="space-y-4">
              <p className="text-sm text-ink">{brief.headline}</p>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-muted uppercase">Current priorities</h3>
                {brief.priorities.length ? (
                  <ol className="space-y-1.5">
                    {brief.priorities.map((p, i) => (
                      <li key={`${p.title}-${i}`} className="flex gap-2 text-sm">
                        <span className="font-mono text-xs text-accent">{i + 1}.</span>
                        <span>
                          {p.href ? (
                            <Link href={p.href} className="text-ink hover:text-accent">
                              {p.title}
                            </Link>
                          ) : (
                            p.title
                          )}
                          <span className="block text-xs text-muted">{p.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted">Nothing urgent. Start a research mission to fill the pipeline.</p>
                )}
              </div>
              {brief.brands_needing_attention.length ? (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-muted uppercase">Brands needing attention</h3>
                  <ul className="space-y-1 text-sm">
                    {brief.brands_needing_attention.map((b) => (
                      <li key={b.brand_code}>
                        <span className="font-mono text-xs text-accent">{b.brand_code}</span> <span className="text-ink-2">{b.reason}</span> — <span className="text-muted">{b.recommended_action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brief.revisit_candidates.length ? (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-muted uppercase">Worth revisiting</h3>
                  <ul className="space-y-1 text-xs text-ink-2">
                    {brief.revisit_candidates.slice(0, 5).map((r) => (
                      <li key={r.opportunity_code}>
                        <span className="font-mono text-accent">{r.opportunity_code}</span> — {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Approval requests" actions={<ButtonLink href="/approvals" size="sm" variant="ghost">All</ButtonLink>} />
            <CardBody>
              {approvals.data?.length ? (
                <ul className="space-y-2">
                  {approvals.data.map((g) => (
                    <li key={g.id}>
                      <Link href={`/approvals/${g.id}`} className="block rounded-md border border-line px-2.5 py-2 hover:border-line-strong">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-muted">{g.code}</span>
                          <Badge tone="warning">{g.gate_type.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink">{g.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No approvals waiting.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Alerts" actions={<ButtonLink href="/notifications" size="sm" variant="ghost">All</ButtonLink>} />
            <CardBody>
              {alerts.data?.length ? (
                <ul className="space-y-2">
                  {alerts.data.map((n) => (
                    <li key={n.id} className="flex items-start gap-2">
                      <StatusChip status={n.severity === "critical" ? "critical" : "medium"} label={n.severity} />
                      {n.link ? (
                        <Link href={n.link} className="text-xs text-ink-2 hover:text-ink">
                          {n.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-2">{n.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No unread alerts.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent agent activity" actions={<ButtonLink href="/agents" size="sm" variant="ghost">Agents</ButtonLink>} />
            <CardBody>
              <ActivityFeed entries={activity.data ?? []} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
