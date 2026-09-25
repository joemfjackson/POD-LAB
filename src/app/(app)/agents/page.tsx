import type { Metadata } from "next";
import Link from "next/link";
import { AGENT_DEFINITIONS } from "@/agents/registry";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { JobsTable, type JobRowView } from "@/components/shared/jobs-table";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import { formatDuration, formatPct, formatUsd } from "@/domain/format";
import { rangeStart } from "@/domain/financial-model";
import { roleAtLeast } from "@/domain/permissions";
import { processQueueAction } from "@/server/actions/agents";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Agents" };

const JOB_STATUSES = ["queued", "running", "waiting_for_approval", "completed", "failed", "cancelled"] as const;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ status?: string; agent?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const ws = ctx.workspace.id;
  const since = `${rangeStart("30d")}T00:00:00Z`;
  let jobsQ = ctx.db
    .from("agent_jobs")
    .select("id, code, agent_key, status, attempts, max_attempts, result_summary, error, created_at, requested_by_actor, brands(code)")
    .eq("workspace_id", ws)
    .order("created_at", { ascending: false })
    .limit(60);
  if (JOB_STATUSES.includes(sp.status as (typeof JOB_STATUSES)[number])) jobsQ = jobsQ.eq("status", sp.status as (typeof JOB_STATUSES)[number]);
  if (sp.agent) jobsQ = jobsQ.eq("agent_key", sp.agent);
  const [configs, runs, jobCounts, jobs, activity] = await Promise.all([
    ctx.db.from("agents").select("key, enabled, model, provider").eq("workspace_id", ws),
    ctx.db.from("agent_runs").select("agent_key, status, duration_ms, estimated_cost_usd, started_at").eq("workspace_id", ws).gte("started_at", since),
    ctx.db.from("agent_jobs").select("agent_key, status").eq("workspace_id", ws),
    jobsQ,
    ctx.db.from("audit_log").select("id, actor_type, agent_key, summary, created_at, brand_id, subject_type, subject_id").eq("workspace_id", ws).eq("actor_type", "agent").order("created_at", { ascending: false }).limit(20),
  ]);

  const stats = AGENT_DEFINITIONS.map((a) => {
    const r = (runs.data ?? []).filter((x) => x.agent_key === a.key);
    const done = r.filter((x) => x.status !== "running");
    const ok = done.filter((x) => x.status === "succeeded").length;
    const durations = done.map((x) => x.duration_ms).filter((d): d is number => d !== null);
    const j = (jobCounts.data ?? []).filter((x) => x.agent_key === a.key);
    const cfg = configs.data?.find((c) => c.key === a.key);
    return {
      def: a,
      enabled: cfg?.enabled ?? true,
      model: cfg?.model,
      running: j.some((x) => x.status === "running" || x.status === "queued"),
      lastRun: r.reduce<string | null>((m, x) => (!m || x.started_at > m ? x.started_at : m), null),
      successRate: done.length ? ok / done.length : null,
      avgMs: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null,
      jobs: j.length,
      failures: j.filter((x) => x.status === "failed").length,
      cost: r.reduce((s, x) => s + Number(x.estimated_cost_usd), 0),
    };
  });

  return (
    <>
      <PageHeader
        title="Agent control center"
        description="Specialist agents coordinated by the Director. Every run is logged with input, validated output, provider/model, prompt version, usage and cost."
        actions={
          <>
            {roleAtLeast(ctx.role, "admin") ? <ActionForm action={processQueueAction} submitLabel="Process queue" variant="secondary" inline /> : null}
            {roleAtLeast(ctx.role, "admin") ? (
              <Link href="/settings/agents" className={buttonClass("ghost")}>
                Configure agents
              </Link>
            ) : null}
          </>
        }
      />
      <Card className="mb-5">
        <CardHeader title="Agents" description="Stats cover the last 30 days of runs." />
        <Table>
          <THead>
            <tr>
              <TH>Agent</TH>
              <TH>Function</TH>
              <TH>Status</TH>
              <TH>Last run</TH>
              <TH className="text-right">Success</TH>
              <TH className="text-right">Avg runtime</TH>
              <TH className="text-right">Jobs</TH>
              <TH className="text-right">Failures</TH>
              <TH className="text-right">Cost (30d)</TH>
              <TH>
                <span className="sr-only">Run</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {stats.map((s) => (
              <TR key={s.def.key}>
                <TD>
                  <p className="font-medium text-ink">{s.def.name}</p>
                  <p className="text-[11px] text-muted">
                    Phase {s.def.phase} · {s.model ?? "default model"}
                  </p>
                </TD>
                <TD className="max-w-sm text-xs text-ink-2">
                  {s.def.description}
                  <p className="mt-0.5 text-muted italic">{s.def.businessQuestion}</p>
                </TD>
                <TD>{!s.enabled ? <Badge tone="muted">disabled</Badge> : s.running ? <Badge tone="accent" dot>active</Badge> : <Badge tone="good" dot>idle</Badge>}</TD>
                <TD className="text-xs">
                  <Time value={s.lastRun} />
                </TD>
                <TD className="text-right text-xs tabular">{formatPct(s.successRate, 0)}</TD>
                <TD className="text-right text-xs tabular">{formatDuration(s.avgMs)}</TD>
                <TD className="text-right text-xs tabular">
                  <Link href={`/agents?agent=${s.def.key}`} className="hover:text-accent">
                    {s.jobs}
                  </Link>
                </TD>
                <TD className="text-right text-xs tabular">{s.failures ? <Link href={`/agents?agent=${s.def.key}&status=failed`} className="text-critical-ink">{s.failures}</Link> : 0}</TD>
                <TD className="text-right text-xs tabular">{formatUsd(s.cost)}</TD>
                <TD>{!s.def.brandScoped && ctx.role !== "viewer" && s.def.key !== "opportunity_scout" ? <RunAgentButton agent={s.def.key} label="Run" /> : null}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Jobs"
            actions={
              <form className="flex items-center gap-2" aria-label="Filter jobs">
                <label htmlFor="job-agent" className="sr-only">
                  Agent
                </label>
                <Select id="job-agent" name="agent" defaultValue={sp.agent ?? ""} className="h-8 w-44 text-xs">
                  <option value="">All agents</option>
                  {AGENT_DEFINITIONS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <label htmlFor="job-status" className="sr-only">
                  Status
                </label>
                <Select id="job-status" name="status" defaultValue={sp.status ?? ""} className="h-8 w-40 text-xs">
                  <option value="">All statuses</option>
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                  Filter
                </button>
              </form>
            }
          />
          <JobsTable jobs={(jobs.data ?? []) as JobRowView[]} />
        </Card>
        <Card>
          <CardHeader title="Activity stream" />
          <CardBody>
            <ActivityFeed entries={activity.data ?? []} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
