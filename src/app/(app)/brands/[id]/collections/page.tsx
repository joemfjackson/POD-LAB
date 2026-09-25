import Link from "next/link";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getBrand } from "@/server/queries/brand";

export default async function BrandCollections({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const cols = await ctx.db.from("collections").select("*, design_concepts(id, code, title, status)").eq("brand_id", id).order("sort_order");
  if (!cols.data?.length) return <EmptyState title="No collections" description="Collections are created by the Creative Director." />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cols.data.map((c) => (
        <Card key={c.id}>
          <CardHeader title={c.name} description={c.description} actions={<><StatusChip status={c.status === "concept" ? "idea" : c.status} label={c.status} /><DemoBadge show={c.is_demo} /></>} />
          <CardBody>
            {c.theme ? <p className="mb-2 text-xs text-muted">Theme: {c.theme}</p> : null}
            {c.design_concepts.length ? (
              <ul className="space-y-1 text-xs">
                {c.design_concepts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <Link href={`/design-studio/${d.id}`} className="truncate text-ink-2 hover:text-accent">
                      <span className="font-mono text-muted">{d.code}</span> {d.title}
                    </Link>
                    <StatusChip status={d.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No designs yet.</p>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
