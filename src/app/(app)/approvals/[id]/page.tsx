import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GateDecisionForm } from "@/components/approvals/gate-decision-form";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue, Notice, Pre } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import type { GateType } from "@/domain/lifecycle";
import { canDecideGate, gateMinRole } from "@/domain/permissions";
import { commentGateAction, decideGateAction } from "@/server/actions/approvals";
import { getContext } from "@/server/context";
import { subjectHref } from "../subject-link";

export const metadata: Metadata = { title: "Approval" };

const EXPLAIN: Record<GateType, string> = {
  opportunity_approval: "Approving creates (or advances) the Brand Record and unlocks Brand Architect.",
  brand_name_final: "Approving makes this the brand's official name. Trademark notes are preliminary — not a clearance.",
  brand_identity_final: "Approving finalises the identity and moves the brand into creative work.",
  design_production: "Approving marks the design production-ready (or approved-pending-compliance if screening is not clear).",
  compliance_override: "Approving overrides the automated compliance flag. Your notes are stored as the override justification. Not legal advice.",
  product_assortment: "Approving the listed products unlocks the store build.",
  store_launch: "Approving authorises launch. Replace placeholder privacy/terms pages first.",
  paid_campaign_spend: "Approving authorises spending up to the approved budget. Nothing is spent automatically.",
  scale_approval: "Approving moves the brand to Scaling.",
  provider_credentials: "Approving activates the stored (encrypted) credential for server-side use.",
  destructive_action: "Approving executes an irreversible or destructive action.",
};

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const res = await ctx.db
    .from("approval_gates")
    .select("*, brands(id, code, working_title, official_name), requester:requested_by(display_name, email), decider:decided_by(display_name, email), agent_jobs(id, code, agent_key)")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();
  if (!res.data) notFound();
  const g = res.data;
  const comments = await ctx.db.from("approval_comments").select("id, body, created_at, users:author_id(display_name, email)").eq("gate_id", id).order("created_at");
  const gateType = g.gate_type as GateType;
  const payload = (g.payload ?? {}) as Record<string, unknown>;
  const href = subjectHref(g.subject_type, g.subject_id, g.brand_id, payload);
  const canDecide = g.status === "pending" && canDecideGate(ctx.role, gateType);
  const products =
    gateType === "product_assortment" && Array.isArray(payload.brand_product_ids)
      ? await ctx.db.from("brand_products").select("id, code, title, retail_price, recommendation, economics").in("id", payload.brand_product_ids as string[])
      : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Approvals", href: "/approvals" }, { label: g.code }]}
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{g.code}</span>
            <Badge tone="warning">{gateType.replace(/_/g, " ")}</Badge>
            <StatusChip status={g.status} />
          </div>
        }
        title={g.title}
        description={g.summary}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Notice tone="info" title="What approval does">
            {EXPLAIN[gateType]}
          </Notice>
          <Card>
            <CardHeader title="Request" />
            <CardBody>
              <KeyValue
                items={[
                  { label: "Subject", value: href ? <Link href={href} className="text-accent hover:underline">{`Open ${g.subject_type.replace(/_/g, " ")}`}</Link> : g.subject_type },
                  { label: "Brand", value: g.brands ? <Link href={`/brands/${g.brands.id}`} className="text-accent">{`${g.brands.code} · ${g.brands.official_name ?? g.brands.working_title}`}</Link> : null },
                  { label: "Requested by", value: g.requested_by_actor === "human" ? ((g.requester as { display_name: string | null } | null)?.display_name ?? "—") : `${g.requested_by_actor}${g.agent_jobs ? ` (${g.agent_jobs.code})` : ""}` },
                  { label: "Requested", value: <Time value={g.created_at} relative={false} /> },
                  { label: "Minimum role to decide", value: gateMinRole(gateType) },
                  { label: "Decision", value: g.status === "pending" ? "Pending" : `${g.status.replace("_", " ")} by ${(g.decider as { display_name: string | null } | null)?.display_name ?? "—"}` },
                  { label: "Decided at", value: <Time value={g.decided_at} relative={false} /> },
                  { label: "Reason", value: g.decision_reason },
                ]}
              />
            </CardBody>
          </Card>
          {products?.data?.length ? (
            <Card>
              <CardHeader title="Products in this assortment" />
              <CardBody>
                <ul className="divide-y divide-line text-sm">
                  {products.data.map((p) => {
                    const unit = (p.economics as { unit?: { grossMargin: number | null; contributionMargin: number | null; breakEvenCac: number } }).unit;
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className="font-mono text-xs text-muted">{p.code}</span>
                        <span className="flex-1">{p.title}</span>
                        <span className="tabular">${Number(p.retail_price).toFixed(2)}</span>
                        <span className="text-xs text-muted tabular">GM {unit?.grossMargin !== null && unit?.grossMargin !== undefined ? `${(unit.grossMargin * 100).toFixed(0)}%` : "—"} · BE-CAC ${unit?.breakEvenCac?.toFixed(2) ?? "—"}</span>
                        <StatusChip status={p.recommendation} />
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ) : null}
          {Object.keys(payload).length ? (
            <Card>
              <CardHeader title="Payload" />
              <CardBody>
                <Pre value={payload} />
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Comments" />
            <CardBody>
              {comments.data?.length ? (
                <ul className="space-y-3">
                  {comments.data.map((c) => (
                    <li key={c.id} className="text-sm">
                      <p className="text-xs text-muted">
                        {(c.users as { display_name: string | null } | null)?.display_name ?? "—"} · <Time value={c.created_at} />
                      </p>
                      <p className="whitespace-pre-line text-ink-2">{c.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No comments.</p>
              )}
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader title="Decide" />
            <CardBody>
              {canDecide ? (
                <GateDecisionForm gateId={g.id} decide={decideGateAction} comment={commentGateAction} minRoleNote={`Requires ${gateMinRole(gateType)} role or above. You are ${ctx.role}.`} />
              ) : g.status === "pending" ? (
                <Notice tone="warning">Your role ({ctx.role}) cannot decide this approval — it needs {gateMinRole(gateType)} or above.</Notice>
              ) : (
                <p className="text-sm text-ink-2">This request has been decided.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
