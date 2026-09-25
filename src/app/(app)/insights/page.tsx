import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, ConfidenceChip, DemoBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { EmptyState, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import { archiveInsightAction, createInsightAction } from "@/server/actions/knowledge";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Insights" };

const CLAIM_HELP: Record<string, string> = {
  observation: "What happened — no causal claim",
  correlation: "Two things moved together — not proof of cause",
  hypothesis: "A belief to test",
  validated: "Confirmed by a completed experiment",
};

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ brand?: string; claim?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  let q = ctx.db.from("insights").select("*, brands(id, code), experiments(id, code)").eq("workspace_id", ctx.workspace.id).eq("status", "active").order("created_at", { ascending: false });
  if (sp.brand) q = q.eq("brand_id", sp.brand);
  if (sp.claim) q = q.eq("claim_type", sp.claim);
  const [insights, brands, experiments] = await Promise.all([
    q,
    ctx.db.from("brands").select("id, code, working_title").eq("workspace_id", ctx.workspace.id).order("code"),
    ctx.db.from("experiments").select("id, code, name").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const canEdit = ctx.role !== "viewer";
  return (
    <>
      <PageHeader title="Insights" description="Institutional knowledge from experiments and operators. Every insight states its claim type and confidence — POD Lab never presents correlations as causes." />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {insights.data?.length ? (
            insights.data.map((i) => (
              <Card key={i.id}>
                <CardBody>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted">{i.code}</span>
                    <Badge tone={i.claim_type === "validated" ? "good" : i.claim_type === "hypothesis" ? "neutral" : "accent"} title={CLAIM_HELP[i.claim_type]}>
                      {i.claim_type}
                    </Badge>
                    <ConfidenceChip level={i.confidence} />
                    <Badge tone="muted">{i.source === "human" ? "user-created" : "system-generated"}</Badge>
                    <DemoBadge show={i.is_demo} />
                  </div>
                  <p className="text-sm font-medium text-ink">{i.title}</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{i.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {i.evidence_summary ? `${i.evidence_summary} · ` : ""}
                    {i.sample_size !== null ? `n=${i.sample_size} · ` : ""}
                    {i.brands ? (
                      <Link href={`/brands/${i.brands.id}`} className="text-accent">
                        {i.brands.code}
                      </Link>
                    ) : null}
                    {i.experiments ? (
                      <>
                        {" · "}
                        <Link href={`/experiments/${i.experiments.id}`} className="text-accent">
                          {i.experiments.code}
                        </Link>
                      </>
                    ) : null}{" "}
                    · <Time value={i.created_at} />
                    {i.tags.length ? ` · #${i.tags.join(" #")}` : ""}
                  </p>
                  {canEdit ? (
                    <div className="mt-2">
                      <ActionForm action={archiveInsightAction} submitLabel="Archive" size="sm" variant="ghost" hidden={{ insight_id: i.id }} inline />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ))
          ) : (
            <EmptyState title="No insights yet" description="The Experiment Analyst proposes insights from completed experiments; you can also record your own." />
          )}
        </div>
        {canEdit ? (
          <Card>
            <CardHeader title="Record an insight" />
            <CardBody>
              <Notice tone="info">Use “correlation” when two things moved together and “validated” only when an experiment confirmed it.</Notice>
              <div className="mt-3">
                <ActionForm action={createInsightAction} submitLabel="Save insight" resetOnSuccess>
                  <Field label="Title" htmlFor="ins-title">
                    <Input id="ins-title" name="title" required minLength={3} />
                  </Field>
                  <Field label="Details" htmlFor="ins-body">
                    <Textarea id="ins-body" name="body" required rows={3} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Claim type" htmlFor="ins-claim">
                      <Select id="ins-claim" name="claim_type" defaultValue="observation">
                        {Object.entries(CLAIM_HELP).map(([k, v]) => (
                          <option key={k} value={k} title={v}>
                            {k}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Confidence" htmlFor="ins-conf">
                      <Select id="ins-conf" name="confidence" defaultValue="low">
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Evidence summary" htmlFor="ins-ev">
                    <Input id="ins-ev" name="evidence_summary" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Brand" htmlFor="ins-brand">
                      <Select id="ins-brand" name="brand_id" defaultValue="">
                        <option value="">None</option>
                        {(brands.data ?? []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} {b.working_title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Experiment" htmlFor="ins-exp">
                      <Select id="ins-exp" name="experiment_id" defaultValue="">
                        <option value="">None</option>
                        {(experiments.data ?? []).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.code} {x.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sample size" htmlFor="ins-n">
                      <Input id="ins-n" name="sample_size" type="number" min={0} />
                    </Field>
                    <Field label="Tags (comma separated)" htmlFor="ins-tags">
                      <Input id="ins-tags" name="tags" />
                    </Field>
                  </div>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
