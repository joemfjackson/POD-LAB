import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENT_BY_KEY, isAgentKey } from "@/agents/registry";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue, Notice, Pre } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import { formatDuration, formatUsd } from "@/domain/format";
import { cancelJobAction, retryJobAction } from "@/server/actions/agents";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Agent job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const job = await ctx.db.from("agent_jobs").select("*, brands(id, code), requester:requested_by(display_name)").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!job.data) notFound();
  const j = job.data;
  const [runs, outputs, gates, children] = await Promise.all([
    ctx.db.from("agent_runs").select("*").eq("job_id", id).order("attempt"),
    ctx.db.from("agent_outputs").select("id, run_id, output_type, schema_version, data, created_at").eq("job_id", id),
    ctx.db.from("approval_gates").select("id, code, title, status").eq("job_id", id),
    ctx.db.from("agent_jobs").select("id, code, agent_key, status").eq("parent_job_id", id),
  ]);
  const name = isAgentKey(j.agent_key) ? AGENT_BY_KEY[j.agent_key].name : j.agent_key;
  const canRun = ctx.role !== "viewer";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Agents", href: "/agents" }, { label: j.code }]}
        eyebrow={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{j.code}</span>
            <StatusChip status={j.status} />
          </div>
        }
        title={name}
        description={j.result_summary ?? undefined}
        actions={
          canRun ? (
            <>
              {j.status === "failed" || j.status === "cancelled" ? <ActionForm action={retryJobAction} submitLabel="Retry" hidden={{ job_id: j.id }} inline /> : null}
              {j.status === "queued" ? <ActionForm action={cancelJobAction} submitLabel="Cancel" variant="danger" hidden={{ job_id: j.id }} inline /> : null}
            </>
          ) : null
        }
      />
      {j.error && j.status !== "completed" ? (
        <div className="mb-4">
          <Notice tone="critical" title={j.status === "queued" ? "Last attempt failed — retrying" : "Failed"}>
            {j.error}
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {(runs.data ?? []).map((r) => {
            const out = outputs.data?.find((o) => o.run_id === r.id);
            const sources = (r.sources as Array<{ ref: string; url: string; title: string; publisher: string | null; retrieved_at: string }>) ?? [];
            return (
              <Card key={r.id}>
                <CardHeader
                  title={`Run · attempt ${r.attempt}`}
                  description={<>Started <Time value={r.started_at} relative={false} /></>}
                  actions={<StatusChip status={r.status} />}
                />
                <CardBody className="space-y-4">
                  <KeyValue
                    columns={3}
                    items={[
                      { label: "Provider / model", value: `${r.provider} / ${r.model}` },
                      { label: "Temperature", value: r.temperature ?? "—" },
                      { label: "Prompt version", value: <span className="font-mono">{r.prompt_version}</span> },
                      { label: "Schema version", value: <span className="font-mono">{r.schema_version}</span> },
                      { label: "Tokens (in / out)", value: `${r.input_tokens ?? "—"} / ${r.output_tokens ?? "—"}${r.usage_is_estimated ? " (estimated)" : ""}` },
                      { label: "Cost", value: `${formatUsd(Number(r.estimated_cost_usd))}${r.usage_is_estimated ? " (estimated)" : ""}` },
                      { label: "Duration", value: formatDuration(r.duration_ms) },
                      { label: "Validation retries", value: r.validation_retries },
                      { label: "Sources", value: sources.length },
                    ]}
                  />
                  {r.error ? <Notice tone="critical">{r.error}</Notice> : null}
                  {r.validation_errors ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-serious">Validation errors (malformed output was discarded)</summary>
                      <Pre value={r.validation_errors} className="mt-2" />
                    </details>
                  ) : null}
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">Input</summary>
                    <Pre value={r.input} className="mt-2" />
                  </details>
                  {out ? (
                    <details open>
                      <summary className="cursor-pointer text-xs text-muted">
                        Structured output · {out.output_type} · <span className="font-mono">{out.schema_version}</span> · validated
                      </summary>
                      <Pre value={out.data} className="mt-2" />
                    </details>
                  ) : null}
                  {sources.length ? (
                    <div>
                      <p className="mb-1 text-xs text-muted">Sources retrieved</p>
                      <ul className="space-y-1 text-xs">
                        {sources.map((s) => (
                          <li key={s.ref}>
                            <span className="font-mono text-muted">{s.ref}</span>{" "}
                            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                              {s.title}
                            </a>{" "}
                            <span className="text-muted">
                              {s.publisher} · retrieved <Time value={s.retrieved_at} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {r.raw_output && r.status === "failed" ? (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted">Raw model output (not saved as data)</summary>
                      <Pre value={r.raw_output} className="mt-2" />
                    </details>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
          {!runs.data?.length ? <Notice tone="info">No runs yet — the job is {j.status.replace(/_/g, " ")}.</Notice> : null}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Job" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: "Type", value: j.type },
                  { label: "Brand", value: j.brands ? <Link href={`/brands/${j.brands.id}`} className="text-accent">{j.brands.code}</Link> : "—" },
                  { label: "Requested by", value: j.requested_by_actor === "human" ? ((j.requester as { display_name: string | null } | null)?.display_name ?? "human") : j.requested_by_actor },
                  { label: "Priority", value: j.priority },
                  { label: "Attempts", value: `${j.attempts} / ${j.max_attempts}` },
                  { label: "Scheduled", value: <Time value={j.scheduled_at} relative={false} /> },
                  { label: "Started", value: <Time value={j.started_at} relative={false} /> },
                  { label: "Completed", value: <Time value={j.completed_at} relative={false} /> },
                  { label: "Dedupe key", value: <span className="font-mono text-[11px] break-all">{j.dedupe_key ?? "—"}</span> },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payload" />
            <CardBody>
              <Pre value={j.payload} />
            </CardBody>
          </Card>
          {gates.data?.length || children.data?.length ? (
            <Card>
              <CardHeader title="Routed by the Director" />
              <CardBody>
                <ul className="space-y-1.5 text-xs">
                  {(gates.data ?? []).map((g) => (
                    <li key={g.id}>
                      <Badge tone="warning">approval</Badge>{" "}
                      <Link href={`/approvals/${g.id}`} className="text-accent">
                        {g.code}
                      </Link>{" "}
                      {g.title} <StatusChip status={g.status} />
                    </li>
                  ))}
                  {(children.data ?? []).map((c) => (
                    <li key={c.id}>
                      <Badge tone="accent">follow-up</Badge>{" "}
                      <Link href={`/agents/jobs/${c.id}`} className="text-accent">
                        {c.code}
                      </Link>{" "}
                      {isAgentKey(c.agent_key) ? AGENT_BY_KEY[c.agent_key].name : c.agent_key} <StatusChip status={c.status} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
