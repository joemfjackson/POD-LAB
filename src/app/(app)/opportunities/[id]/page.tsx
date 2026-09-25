import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ScoutOpportunity } from "@/agents/schemas";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, ConfidenceChip, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/fields";
import { KeyValue, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ScoreGrid } from "@/components/ui/score";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import { formatDate, humanize } from "@/domain/format";
import { scoreProfile, type DimensionScore } from "@/domain/scoring";
import { archiveOpportunityAction, decideOpportunityAction, researchDeeperAction, sendToArchitectAction } from "@/server/actions/opportunities";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Opportunity" };

const KIND_ORDER = ["measured_fact", "observed_signal", "inferred_conclusion", "assumption"] as const;
const KIND_LABEL: Record<string, string> = {
  measured_fact: "Measured facts",
  observed_signal: "Observed signals",
  inferred_conclusion: "Inferred conclusions",
  assumption: "Assumptions",
};

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const opp = await ctx.db.from("opportunities").select("*, opportunity_scores(dimension, score, explanation, evidence_kind), research_missions(code, title)").eq("id", id).maybeSingle();
  if (!opp.data) notFound();
  const o = opp.data;
  const [reports, sources, brand, gates] = await Promise.all([
    ctx.db.from("research_reports").select("id, title, research_mode, created_at, snapshot, is_demo, agent_run_id").eq("opportunity_id", id).order("created_at", { ascending: false }),
    ctx.db.from("research_sources").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }),
    o.brand_id ? ctx.db.from("brands").select("id, code, working_title, official_name, stage").eq("id", o.brand_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.db.from("approval_gates").select("id, code, status, decided_at, decision_reason, users:decided_by(display_name, email)").eq("subject_id", id).order("created_at", { ascending: false }),
  ]);
  const latest = reports.data?.[0];
  const snapshot = (latest?.snapshot as { opportunity?: ScoutOpportunity; method_note?: string; confidence_ceiling?: string; confidence_claimed?: string } | null) ?? null;
  const dims = snapshot?.opportunity?.research_dimensions;
  const scores = o.opportunity_scores.map((s) => ({ dimension: s.dimension, score: Number(s.score), explanation: s.explanation }));
  const profile = scoreProfile(scores as DimensionScore[]);
  const latestReportSources = (sources.data ?? []).filter((s) => !latest || s.report_id === latest.id);
  const canEdit = ctx.role !== "viewer";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Opportunities", href: "/opportunities" }, { label: o.code }]}
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{o.code}</span>
            <StatusChip status={o.status} />
            <ConfidenceChip level={o.confidence} />
            <Badge tone="muted">{o.research_mode ?? "not researched"}</Badge>
            <DemoBadge show={o.is_demo} />
          </div>
        }
        title={o.niche}
        description={o.hypothesis}
        actions={brand.data ? <ButtonLink href={`/brands/${brand.data.id}`}>Open {brand.data.code}</ButtonLink> : null}
      />

      {o.research_mode === "demo" ? (
        <div className="mb-4">
          <Notice tone="demo">This report was produced by the demo provider. Scores and statements are placeholders labelled as assumptions — not market evidence.</Notice>
        </div>
      ) : o.research_mode === "model_only" ? (
        <div className="mb-4">
          <Notice tone="warning">No live research provider was configured for this run. Findings come from model knowledge and are labelled as assumptions/inferences; confidence is capped at low.</Notice>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Scores" description={`${profile.summary} Weighted index ${profile.weightedIndex ?? "—"} (a summary, not the decision).`} />
            <CardBody>
              <ScoreGrid scores={scores} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Summary & recommendations" />
            <CardBody className="space-y-4">
              <p className="text-sm whitespace-pre-line text-ink-2">{o.summary}</p>
              <KeyValue
                items={[
                  { label: "Audience", value: o.audience },
                  { label: "Recommended customer", value: o.recommended_customer },
                  { label: "Recommended brand angle", value: o.recommended_brand_angle },
                  { label: "Recommended first products", value: o.recommended_first_products.join(", ") || "—" },
                  { label: "Recommended test strategy", value: o.recommended_test_strategy },
                  { label: "Suggested sub-niches", value: o.suggested_sub_niches.join(", ") || "—" },
                  { label: "Seasonality", value: o.seasonality },
                  { label: "Strongest signal", value: o.strongest_signal },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Strongest evidence</h3>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-ink-2">
                    {o.strongest_evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Strongest risks</h3>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-ink-2">
                    {o.strongest_risks.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <KeyValue
                columns={3}
                items={[
                  { label: "IP risk", value: o.ip_risk_notes },
                  { label: "Geographic", value: o.geographic_notes },
                  { label: "Cultural risk", value: o.cultural_risk_notes },
                ]}
              />
            </CardBody>
          </Card>

          {dims ? (
            <Card>
              <CardHeader title="Research dimensions" description={snapshot?.method_note} />
              <CardBody>
                <KeyValue
                  items={Object.entries(dims).map(([k, v]) => ({
                    label: humanize(k),
                    value: Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? `$${(v as { low: number }).low}–$${(v as { high: number }).high}` : String(v ?? "—"),
                  }))}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Evidence & sources" description="Facts and signals must cite a retrieved source. Anything else is labelled as inference or assumption." />
            <CardBody className="space-y-5">
              {KIND_ORDER.map((kind) => {
                const items = latestReportSources.filter((s) => s.evidence_kind === kind);
                return (
                  <div key={kind}>
                    <h3 className="mb-2 text-xs font-semibold text-muted uppercase">
                      {KIND_LABEL[kind]} <span className="tabular">({items.length})</span>
                    </h3>
                    {items.length ? (
                      <Table>
                        <THead>
                          <tr>
                            <TH>Claim</TH>
                            <TH>Source</TH>
                            <TH>Published</TH>
                            <TH>Retrieved</TH>
                            <TH>Confidence</TH>
                          </tr>
                        </THead>
                        <TBody>
                          {items.map((s) => (
                            <TR key={s.id}>
                              <TD className="max-w-md">
                                <p className="text-xs text-ink">{s.claim}</p>
                                {s.quote_snippet ? <p className="mt-1 text-[11px] text-muted italic">“{s.quote_snippet}”</p> : null}
                              </TD>
                              <TD className="text-xs">
                                {s.source_url ? (
                                  <a href={s.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                                    {s.source_title ?? s.publisher ?? "source"}
                                  </a>
                                ) : (
                                  <span className="text-muted">No source</span>
                                )}
                                <p className="text-[11px] text-muted">{s.publisher ?? s.source_type}</p>
                              </TD>
                              <TD className="text-xs text-muted">{formatDate(s.published_at)}</TD>
                              <TD className="text-xs text-muted">{formatDate(s.retrieved_at)}</TD>
                              <TD>
                                <ConfidenceChip level={s.confidence} />
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    ) : (
                      <p className="text-xs text-muted">None.</p>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          {canEdit ? (
            <Card>
              <CardHeader title="Decision" description="Approval creates the Brand Record automatically." />
              <CardBody className="space-y-4">
                {o.status !== "approved" ? (
                  <>
                    <ActionForm action={decideOpportunityAction} submitLabel="Approve opportunity" hidden={{ opportunity_id: o.id, decision: "approved" }}>
                      <Field label="Reason (optional)" htmlFor="approve-reason">
                        <Input id="approve-reason" name="reason" maxLength={2000} placeholder="Why this is worth testing" />
                      </Field>
                      <Checkbox name="send_to_architect" label="Then send to Brand Architect" />
                    </ActionForm>
                    <ActionForm action={decideOpportunityAction} submitLabel="Reject" variant="danger" hidden={{ opportunity_id: o.id, decision: "rejected" }}>
                      <Field label="Rejection reason" htmlFor="reject-reason">
                        <Textarea id="reject-reason" name="reason" required minLength={3} maxLength={2000} rows={2} />
                      </Field>
                    </ActionForm>
                  </>
                ) : (
                  <ActionForm action={sendToArchitectAction} submitLabel="Send to Brand Architect" hidden={{ opportunity_id: o.id }} />
                )}
                <ActionForm action={researchDeeperAction} submitLabel="Research deeper" variant="secondary" hidden={{ opportunity_id: o.id }}>
                  <Field label="Depth" htmlFor="depth" hint={`Max ${ctx.workspace.max_research_depth}`}>
                    <Input id="depth" name="research_depth" type="number" min={1} max={ctx.workspace.max_research_depth} defaultValue={Math.min(2, ctx.workspace.max_research_depth)} />
                  </Field>
                </ActionForm>
                {o.status !== "approved" && o.status !== "archived" ? (
                  <ActionForm action={archiveOpportunityAction} submitLabel="Archive" variant="ghost" hidden={{ opportunity_id: o.id }} confirm="Archive this opportunity?" />
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Record" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: "Mission", value: o.research_missions ? `${o.research_missions.code} · ${o.research_missions.title}` : "—" },
                  { label: "Researched", value: <Time value={o.researched_at} relative={false} /> },
                  { label: "Confidence (claimed → capped)", value: snapshot?.confidence_claimed ? `${snapshot.confidence_claimed} → ${o.confidence}` : (o.confidence ?? "—") },
                  { label: "Brand", value: brand.data ? <Link className="text-accent" href={`/brands/${brand.data.id}`}>{`${brand.data.code} · ${brand.data.official_name ?? brand.data.working_title}`}</Link> : "Created on approval" },
                  { label: "Rejected reason", value: o.rejected_reason },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Approval history" />
            <CardBody>
              {gates.data?.length ? (
                <ul className="space-y-2 text-xs">
                  {gates.data.map((g) => (
                    <li key={g.id}>
                      <Link href={`/approvals/${g.id}`} className="font-mono text-accent">
                        {g.code}
                      </Link>{" "}
                      <StatusChip status={g.status} />{" "}
                      {g.decided_at ? (
                        <span className="text-muted">
                          by {(g.users as { display_name: string | null; email: string } | null)?.display_name ?? "—"} <Time value={g.decided_at} />
                          {g.decision_reason ? ` — ${g.decision_reason}` : ""}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No decisions yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Research history" />
            <CardBody>
              <ul className="space-y-2 text-xs">
                {(reports.data ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink-2">{r.title}</span>
                    <span className="shrink-0 text-muted">
                      {r.research_mode} · <Time value={r.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
