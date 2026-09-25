import type { Metadata } from "next";
import Link from "next/link";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Time } from "@/components/ui/time";
import { gateMinRole } from "@/domain/permissions";
import type { GateType } from "@/domain/lifecycle";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Approvals" };

const VIEWS = ["pending", "approved", "rejected", "revision_requested", "cancelled"] as const;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const status = VIEWS.includes(sp.status as (typeof VIEWS)[number]) ? (sp.status as (typeof VIEWS)[number]) : "pending";
  const [gates, counts] = await Promise.all([
    ctx.db
      .from("approval_gates")
      .select("id, code, gate_type, title, status, created_at, decided_at, requested_by_actor, decision_reason, brands(code), decider:decided_by(display_name)")
      .eq("workspace_id", ctx.workspace.id)
      .eq("status", status)
      .order(status === "pending" ? "created_at" : "decided_at", { ascending: status === "pending" })
      .limit(200),
    ctx.db.from("approval_gates").select("status").eq("workspace_id", ctx.workspace.id),
  ]);
  const countBy = new Map<string, number>();
  for (const r of counts.data ?? []) countBy.set(r.status, (countBy.get(r.status) ?? 0) + 1);

  return (
    <>
      <PageHeader title="Approvals" description="Humans approve every important transition: opportunities, final names and identity, production designs, compliance overrides, assortments, launches, paid spend, scaling, credentials and destructive actions." />
      <Tabs label="Approval status" items={VIEWS.map((v) => ({ label: v.replace("_", " "), href: `/approvals?status=${v}`, active: v === status, count: countBy.get(v) ?? 0 }))} />
      {gates.data?.length ? (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>ID</TH>
                <TH>Request</TH>
                <TH>Type</TH>
                <TH>Brand</TH>
                <TH>Requested by</TH>
                <TH>Decides</TH>
                <TH>{status === "pending" ? "Waiting since" : "Decided"}</TH>
              </tr>
            </THead>
            <TBody>
              {gates.data.map((g) => (
                <TR key={g.id}>
                  <TD className="font-mono text-xs text-muted">{g.code}</TD>
                  <TD>
                    <Link href={`/approvals/${g.id}`} className="text-ink hover:text-accent">
                      {g.title}
                    </Link>
                    {g.decision_reason ? <p className="text-xs text-muted">“{g.decision_reason}”</p> : null}
                  </TD>
                  <TD>
                    <Badge tone="warning">{g.gate_type.replace(/_/g, " ")}</Badge>
                  </TD>
                  <TD className="font-mono text-xs text-muted">{g.brands?.code ?? "—"}</TD>
                  <TD className="text-xs text-ink-2">{g.requested_by_actor}</TD>
                  <TD className="text-xs text-ink-2">{status === "pending" ? `${gateMinRole(g.gate_type as GateType)}+` : ((g.decider as { display_name: string | null } | null)?.display_name ?? "—")}</TD>
                  <TD className="text-xs">
                    <Time value={status === "pending" ? g.created_at : g.decided_at} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState title={`No ${status.replace("_", " ")} approvals`} />
      )}
      <p className="mt-3 text-xs text-muted">
        <StatusChip status="pending" /> requests stay open until a human with the required role decides.
      </p>
    </>
  );
}
