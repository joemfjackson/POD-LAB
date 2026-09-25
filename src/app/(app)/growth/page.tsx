import type { Metadata } from "next";
import Link from "next/link";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUsd } from "@/domain/format";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Growth" };

export default async function GrowthPage() {
  const ctx = await getContext();
  const [campaigns, upcoming] = await Promise.all([
    ctx.db.from("campaigns").select("id, code, name, platform, status, is_paid, proposed_budget_usd, approved_budget_usd, is_demo, brands(id, code), content_items(count)").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }),
    ctx.db.from("content_items").select("id, title, platform, content_type, day_offset, status, brands(code)").eq("workspace_id", ctx.workspace.id).eq("status", "draft").not("day_offset", "is", null).order("day_offset").limit(12),
  ]);
  const pendingSpend = (campaigns.data ?? []).filter((c) => c.is_paid && c.status === "pending_approval");
  return (
    <>
      <PageHeader title="Growth" description="Launch plans from the Growth Agent: channel strategy, content calendars, outreach and paid proposals. Nothing is posted or spent automatically." />
      {pendingSpend.length ? (
        <div className="mb-4">
          <Notice tone="warning" title="Spending approval required">
            {pendingSpend.length} paid proposal(s) totalling {formatUsd(pendingSpend.reduce((s, c) => s + Number(c.proposed_budget_usd ?? 0), 0))} await an admin decision in{" "}
            <Link href="/approvals" className="text-accent hover:underline">
              Approvals
            </Link>
            .
          </Notice>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Campaigns" />
          {campaigns.data?.length ? (
            <Table>
              <THead>
                <tr>
                  <TH>Campaign</TH>
                  <TH>Brand</TH>
                  <TH>Platform</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Budget</TH>
                  <TH className="text-right">Content</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {campaigns.data.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/growth/${c.id}`} className="text-ink hover:text-accent">
                        <span className="font-mono text-xs text-muted">{c.code}</span> {c.name}
                      </Link>{" "}
                      <DemoBadge show={c.is_demo} />
                    </TD>
                    <TD className="font-mono text-xs">{c.brands ? <Link href={`/brands/${c.brands.id}/growth`} className="text-accent">{c.brands.code}</Link> : "—"}</TD>
                    <TD className="text-xs">{c.platform.replace(/_/g, " ")}</TD>
                    <TD>{c.is_paid ? <Badge tone="serious">paid</Badge> : <Badge tone="muted">organic</Badge>}</TD>
                    <TD className="text-right text-xs tabular">{c.is_paid ? `${formatUsd(c.approved_budget_usd ?? c.proposed_budget_usd)}${c.approved_budget_usd === null ? " proposed" : " approved"}` : "—"}</TD>
                    <TD className="text-right text-xs tabular">{(c.content_items as unknown as Array<{ count: number }>)[0]?.count ?? 0}</TD>
                    <TD>
                      <StatusChip status={c.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <CardBody>
              <EmptyState title="No campaigns yet" description="Run the Growth Agent from a launch-ready brand." />
            </CardBody>
          )}
        </Card>
        <Card>
          <CardHeader title="Upcoming drafts" />
          <CardBody>
            <ul className="space-y-2 text-xs">
              {(upcoming.data ?? []).map((c) => (
                <li key={c.id}>
                  <span className="font-mono text-accent">D{c.day_offset}</span> <span className="text-muted">{c.brands?.code} · {c.platform}</span>
                  <p className="text-ink-2">{c.title}</p>
                </li>
              ))}
              {!upcoming.data?.length ? <li className="text-muted">No drafts.</li> : null}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
