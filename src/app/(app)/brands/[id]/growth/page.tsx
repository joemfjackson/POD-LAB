import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatUsd } from "@/domain/format";
import { getBrand } from "@/server/queries/brand";

export default async function BrandGrowth({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const [campaigns, content] = await Promise.all([
    ctx.db.from("campaigns").select("id, code, name, platform, status, is_paid, proposed_budget_usd, approved_budget_usd, objective, is_demo").eq("brand_id", id).order("created_at"),
    ctx.db.from("content_items").select("id, platform, content_type, title, body, day_offset, status").eq("brand_id", id).not("day_offset", "is", null).order("day_offset"),
  ]);
  if (!campaigns.data?.length) return <EmptyState title="No growth plan yet" description="Run the Growth Agent after the store is launch-ready to create a 30-day plan, hooks, outreach and experiments." />;
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-3">
        {campaigns.data.map((c) => (
          <Card key={c.id}>
            <CardHeader
              title={
                <Link href={`/growth/${c.id}`} className="hover:text-accent">
                  {c.code} · {c.name}
                </Link>
              }
              description={c.objective}
              actions={
                <>
                  <StatusChip status={c.status} />
                  {c.is_paid ? <Badge tone="serious">paid</Badge> : <Badge tone="muted">organic</Badge>}
                  <DemoBadge show={c.is_demo} />
                </>
              }
            />
            {c.is_paid ? (
              <CardBody className="text-xs text-muted">
                Proposed {formatUsd(c.proposed_budget_usd)} · approved {c.approved_budget_usd === null ? "— (awaiting approval)" : formatUsd(c.approved_budget_usd)}
              </CardBody>
            ) : null}
          </Card>
        ))}
      </div>
      <Card className="xl:col-span-2">
        <CardHeader title="30-day content calendar" description="Drafts only — POD Lab never posts automatically." />
        <CardBody>
          <ol className="space-y-2">
            {(content.data ?? []).map((c) => (
              <li key={c.id} className="flex gap-3 rounded-md border border-line p-2.5">
                <span className="w-12 shrink-0 font-mono text-xs text-accent">Day {c.day_offset}</span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {c.platform} · {c.content_type.replace(/_/g, " ")} · <StatusChip status={c.status} />
                  </p>
                  <p className="text-sm text-ink">{c.title}</p>
                  <p className="line-clamp-3 text-xs whitespace-pre-line text-ink-2">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
