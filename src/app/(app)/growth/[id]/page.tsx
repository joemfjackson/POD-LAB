import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { formatUsd, humanize } from "@/domain/format";
import { requestGateAction } from "@/server/actions/approvals";
import { setCampaignStatusAction, setContentStatusAction } from "@/server/actions/growth";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const c = await ctx.db.from("campaigns").select("*, brands(id, code)").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!c.data) notFound();
  const camp = c.data;
  const [content, gate] = await Promise.all([
    ctx.db.from("content_items").select("*").eq("campaign_id", id).order("day_offset", { nullsFirst: false }).order("content_type"),
    ctx.db.from("approval_gates").select("id, status").eq("subject_id", id).eq("gate_type", "paid_campaign_spend").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const strategy = (camp.strategy ?? {}) as Record<string, unknown>;
  const canEdit = ctx.role !== "viewer";
  const grouped = new Map<string, typeof content.data>();
  for (const item of content.data ?? []) {
    const k = item.day_offset !== null ? "calendar" : item.content_type;
    grouped.set(k, [...(grouped.get(k) ?? []), item]);
  }
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Growth", href: "/growth" }, { label: camp.code }]}
        eyebrow={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{camp.code}</span>
            <StatusChip status={camp.status} />
            {camp.is_paid ? <Badge tone="serious">paid</Badge> : <Badge tone="muted">organic</Badge>}
            <DemoBadge show={camp.is_demo} />
          </div>
        }
        title={camp.name}
        description={camp.objective}
        actions={
          canEdit ? (
            <>
              {camp.is_paid && camp.status === "draft" && gate.data?.status !== "pending" ? <ActionForm action={requestGateAction} submitLabel="Request spending approval" hidden={{ gate_type: "paid_campaign_spend", subject_id: id }} inline /> : null}
              {(!camp.is_paid && ["draft", "paused"].includes(camp.status)) || (camp.is_paid && ["approved", "paused"].includes(camp.status)) ? <ActionForm action={setCampaignStatusAction} submitLabel="Mark active" hidden={{ campaign_id: id, status: "active" }} inline /> : null}
              {camp.status === "active" ? <ActionForm action={setCampaignStatusAction} submitLabel="Pause" variant="secondary" hidden={{ campaign_id: id, status: "paused" }} inline /> : null}
            </>
          ) : null
        }
      />
      {camp.is_paid ? (
        <div className="mb-4">
          <Notice tone={camp.approved_budget_usd === null ? "warning" : "info"} title="Paid spend">
            Proposed {formatUsd(camp.proposed_budget_usd)}; approved {camp.approved_budget_usd === null ? "— nothing may be spent until an admin approves" : formatUsd(camp.approved_budget_usd)}. POD Lab never launches ads itself.
            {gate.data?.status === "pending" ? (
              <>
                {" "}
                <Link href={`/approvals/${gate.data.id}`} className="text-accent hover:underline">
                  Review approval →
                </Link>
              </>
            ) : null}
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {[...grouped.entries()].map(([k, items]) => (
            <Card key={k}>
              <CardHeader title={k === "calendar" ? "30-day content calendar" : humanize(k)} description={k === "calendar" ? "Drafts. Mark items approved/scheduled/published as you work through them." : undefined} />
              <CardBody>
                <ul className="space-y-2.5">
                  {(items ?? []).map((i) => (
                    <li key={i.id} className="rounded-md border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {i.day_offset !== null ? <span className="font-mono text-accent">Day {i.day_offset}</span> : null}
                        <span>{i.platform}</span>
                        <span>{i.content_type.replace(/_/g, " ")}</span>
                        <StatusChip status={i.status} />
                      </div>
                      <p className="mt-1 text-sm text-ink">{i.title}</p>
                      <p className="mt-1 text-xs whitespace-pre-line text-ink-2">{i.body}</p>
                      {canEdit && i.status === "draft" ? (
                        <div className="mt-2 flex gap-2">
                          <ActionForm action={setContentStatusAction} submitLabel="Approve" size="sm" variant="secondary" hidden={{ content_id: i.id, status: "approved" }} inline />
                          <ActionForm action={setContentStatusAction} submitLabel="Reject" size="sm" variant="ghost" hidden={{ content_id: i.id, status: "rejected" }} inline />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader title="Strategy" />
          <CardBody>
            <KeyValue
              columns={1}
              items={[
                { label: "Brand", value: camp.brands ? <Link href={`/brands/${camp.brands.id}/growth`} className="text-accent">{camp.brands.code}</Link> : null },
                { label: "Platform", value: camp.platform },
                { label: "Audience", value: camp.audience },
                ...Object.entries(strategy).map(([k, v]) => ({
                  label: humanize(k),
                  value:
                    typeof v === "string" ? v : Array.isArray(v) ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs">
                        {v.map((x, i) => (
                          <li key={i}>{typeof x === "string" ? x : Object.values(x as Record<string, unknown>).filter((y) => typeof y === "string" || typeof y === "number").join(" — ")}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs">{Object.entries((v ?? {}) as Record<string, unknown>).map(([a, b]) => `${a}: ${String(b)}`).join("; ")}</span>
                    ),
                })),
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
