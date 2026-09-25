import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/charts/line-chart";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { KeyValue, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import type { DecisionResult, DerivedMetrics } from "@/domain/decision-engine";
import { formatInt, formatPct, formatRatio, formatUsd } from "@/domain/format";
import { addMetricsAction, overrideDecisionAction, setExperimentStatusAction } from "@/server/actions/experiments";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Experiment" };

const METRIC_FIELDS = ["impressions", "clicks", "sessions", "product_views", "add_to_carts", "checkouts", "purchases", "gross_revenue", "discounts", "refunds", "cogs", "fulfillment_cost", "shipping_subsidy", "ad_spend", "repeat_buyers"] as const;

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const e = await ctx.db.from("experiments").select("*, brands(id, code), overrider:overridden_by(display_name)").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!e.data) notFound();
  const exp = e.data;
  const [variants, metrics] = await Promise.all([
    ctx.db.from("experiment_variants").select("*").eq("experiment_id", id).order("key"),
    ctx.db.from("experiment_metrics").select("variant_id, metric_date, sessions, purchases, is_demo, source").eq("experiment_id", id).order("metric_date"),
  ]);
  const details = (exp.decision_details ?? {}) as Partial<Pick<DecisionResult, "checks" | "winner">> & { variants?: Array<{ id: string; key: string; name: string; primary: number | null; derived: DerivedMetrics }>; narrative?: string | null; next_steps?: string[] };
  const reasons = (exp.decision_reasons as string[] | null) ?? [];
  const dates = [...new Set((metrics.data ?? []).map((m) => m.metric_date))].sort();
  const series = (variants.data ?? []).slice(0, 4).map((v) => ({
    name: `${v.key} · ${v.name}`,
    values: dates.map((d) => {
      const rows = (metrics.data ?? []).filter((m) => m.variant_id === v.id && m.metric_date === d);
      const s = rows.reduce((a, r) => a + r.sessions, 0);
      const p = rows.reduce((a, r) => a + r.purchases, 0);
      return s > 0 ? Math.round((p / s) * 10000) / 100 : 0;
    }),
  }));
  const canEdit = ctx.role !== "viewer";
  const effective = exp.override_decision ?? exp.decision;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Experiments", href: "/experiments" }, { label: exp.code }]}
        eyebrow={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{exp.code}</span>
            <StatusChip status={exp.status} />
            <Badge tone="muted">{exp.experiment_type.replace(/_/g, " ")}</Badge>
            <DemoBadge show={exp.is_demo || (metrics.data ?? []).some((m) => m.is_demo)} />
          </div>
        }
        title={exp.name}
        description={exp.hypothesis}
        actions={
          canEdit ? (
            <>
              {exp.status === "draft" || exp.status === "paused" ? <ActionForm action={setExperimentStatusAction} submitLabel="Start" hidden={{ experiment_id: id, status: "running" }} inline /> : null}
              {exp.status === "running" ? <ActionForm action={setExperimentStatusAction} submitLabel="Pause" variant="secondary" hidden={{ experiment_id: id, status: "paused" }} inline /> : null}
              {exp.status === "running" ? <ActionForm action={setExperimentStatusAction} submitLabel="Complete" variant="secondary" hidden={{ experiment_id: id, status: "completed" }} inline /> : null}
              <RunAgentButton agent="experiment_analyst" label="Analyse" params={{ experiment_ids: id }} />
              <ButtonLink href={`/imports?kind=experiment_metrics&experiment=${id}`} size="sm">
                Import metrics CSV
              </ButtonLink>
            </>
          ) : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Decision"
              description={exp.decided_at ? <>Decision engine · <Time value={exp.decided_at} /></> : "Not analysed yet"}
              actions={effective ? <StatusChip status={effective} /> : null}
            />
            <CardBody className="space-y-3">
              {exp.override_decision ? (
                <Notice tone="warning" title="Human override">
                  {exp.override_decision.replace("_", " ")} (engine said {exp.decision?.replace("_", " ") ?? "—"}) by {(exp.overrider as { display_name: string | null } | null)?.display_name ?? "—"}: {exp.override_reason}
                </Notice>
              ) : null}
              {reasons.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Run the Experiment Analyst to classify this experiment against the workspace decision rules.</p>
              )}
              {details.checks?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {details.checks.map((c) => (
                    <Badge key={c.name} tone={c.passed ? "good" : "muted"} dot>
                      {c.name}: {c.unit === "usd" ? formatUsd(c.actual) : formatInt(c.actual)} / {c.unit === "usd" ? formatUsd(c.required) : formatInt(c.required)}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {details.narrative ? <p className="text-sm text-ink-2">{details.narrative}</p> : null}
              {details.next_steps?.length ? (
                <div>
                  <p className="text-xs text-muted">Next steps</p>
                  <ul className="list-disc pl-5 text-xs text-ink-2">
                    {details.next_steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Variants" description={`Primary metric: ${exp.primary_metric.replace(/_/g, " ")} · minimum sample ${formatInt(exp.minimum_sample)} sessions`} />
            <Table>
              <THead>
                <tr>
                  <TH>Variant</TH>
                  <TH className="text-right">Sessions</TH>
                  <TH className="text-right">CTR</TH>
                  <TH className="text-right">CPC</TH>
                  <TH className="text-right">ATC</TH>
                  <TH className="text-right">Purchases</TH>
                  <TH className="text-right">Conv.</TH>
                  <TH className="text-right">AOV</TH>
                  <TH className="text-right">CAC</TH>
                  <TH className="text-right">ROAS</TH>
                  <TH className="text-right">Contribution</TH>
                </tr>
              </THead>
              <TBody>
                {(variants.data ?? []).map((v) => {
                  const d = details.variants?.find((x) => x.id === v.id)?.derived;
                  const winner = details.winner?.variantId === v.id;
                  return (
                    <TR key={v.id}>
                      <TD>
                        <span className="font-mono text-accent">{v.key}</span> {v.name} {v.is_control ? <Badge tone="muted">control</Badge> : null} {winner ? <Badge tone={details.winner?.clear ? "good" : "neutral"}>{details.winner?.clear ? "winner" : "leading"}</Badge> : null}
                        {v.description ? <p className="text-[11px] text-muted">{v.description}</p> : null}
                      </TD>
                      <TD className="text-right text-xs tabular">{formatInt(d?.sessions)}</TD>
                      <TD className="text-right text-xs tabular">{formatPct(d?.ctr, 2)}</TD>
                      <TD className="text-right text-xs tabular">{formatUsd(d?.cpc)}</TD>
                      <TD className="text-right text-xs tabular">{formatPct(d?.addToCartRate)}</TD>
                      <TD className="text-right text-xs tabular">{formatInt(d?.purchases)}</TD>
                      <TD className="text-right text-xs tabular">{formatPct(d?.conversionRate, 2)}</TD>
                      <TD className="text-right text-xs tabular">{formatUsd(d?.aov)}</TD>
                      <TD className="text-right text-xs tabular">{formatUsd(d?.cac)}</TD>
                      <TD className="text-right text-xs tabular">{formatRatio(d?.roas)}</TD>
                      <TD className="text-right text-xs tabular">
                        {formatUsd(d?.contributionProfit)}
                        <span className="block text-muted">{formatPct(d?.contributionMargin)}</span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          {dates.length ? (
            <Card>
              <CardHeader title="Daily conversion rate by variant (%)" />
              <CardBody>
                <LineChart labels={dates.map((d) => d.slice(5))} series={series} ariaLabel="Daily conversion rate by variant" valueFormat="percent" />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Experiment" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: "Brand", value: exp.brands ? <Link href={`/brands/${exp.brands.id}/experiments`} className="text-accent">{exp.brands.code}</Link> : null },
                  { label: "Start / end", value: `${exp.start_date ?? "—"} → ${exp.end_date ?? "—"}` },
                  { label: "Metric rows", value: `${metrics.data?.length ?? 0} (${[...new Set((metrics.data ?? []).map((m) => m.source))].join(", ") || "none"})` },
                ]}
              />
            </CardBody>
          </Card>
          {canEdit && variants.data?.length ? (
            <Card>
              <CardHeader title="Add daily metrics" description="Manual entry per variant and day (re-entering a day replaces it)." />
              <CardBody>
                <ActionForm action={addMetricsAction} submitLabel="Save metrics" hidden={{ experiment_id: id }} resetOnSuccess>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Variant" htmlFor="m-variant">
                      <Select id="m-variant" name="variant_id">
                        {(variants.data ?? []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.key} · {v.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date" htmlFor="m-date">
                      <Input id="m-date" name="metric_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    </Field>
                    {METRIC_FIELDS.map((f) => (
                      <Field key={f} label={f.replace(/_/g, " ")} htmlFor={`m-${f}`}>
                        <Input id={`m-${f}`} name={f} type="number" min={0} step={["gross_revenue", "discounts", "refunds", "cogs", "fulfillment_cost", "shipping_subsidy", "ad_spend"].includes(f) ? "0.01" : "1"} placeholder="0" />
                      </Field>
                    ))}
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          {canEdit ? (
            <Card>
              <CardHeader title="Override decision" description="Humans can override the engine; the reason is stored." />
              <CardBody>
                <ActionForm action={overrideDecisionAction} submitLabel="Save override" hidden={{ experiment_id: id }}>
                  <Field label="Decision" htmlFor="ov-d">
                    <Select id="ov-d" name="override_decision" defaultValue={exp.override_decision ?? exp.decision ?? "keep_collecting"}>
                      {["insufficient_data", "keep_collecting", "kill", "iterate", "clone", "scale"].map((d) => (
                        <option key={d} value={d}>
                          {d.replace("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reason" htmlFor="ov-r">
                    <Textarea id="ov-r" name="override_reason" required minLength={3} rows={2} />
                  </Field>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
