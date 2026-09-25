import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState, KeyValue } from "@/components/ui/misc";
import { Time } from "@/components/ui/time";
import { getBrand } from "@/server/queries/brand";

export default async function BrandStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const store = await ctx.db.from("stores").select("*, store_pages(id, page_type, title, is_placeholder), store_products(count)").eq("brand_id", id).maybeSingle();
  if (!store.data) return <EmptyState title="No store yet" description="Once the assortment is approved, run the Store Builder to generate a complete store package with a live preview." />;
  const s = store.data;
  return (
    <Card>
      <CardHeader
        title={
          <Link href={`/stores/${s.id}`} className="hover:text-accent">
            {s.code} · {s.name}
          </Link>
        }
        description={<>Version {s.version} · updated <Time value={s.updated_at} /></>}
        actions={
          <>
            <StatusChip status={s.status} />
            <DemoBadge show={s.is_demo} />
            <ButtonLink href={`/stores/${s.id}/preview`} size="sm" variant="primary">
              Preview storefront
            </ButtonLink>
            <ButtonLink href={`/stores/${s.id}`} size="sm">
              Manage & export
            </ButtonLink>
          </>
        }
      />
      <CardBody>
        <KeyValue
          items={[
            { label: "SEO title", value: s.seo_title },
            { label: "SEO description", value: s.seo_description },
            { label: "Products", value: (s.store_products as unknown as Array<{ count: number }>)[0]?.count ?? 0 },
            { label: "Pages", value: s.store_pages.map((p) => `${p.title}${p.is_placeholder ? " (placeholder)" : ""}`).join(", ") },
          ]}
        />
      </CardBody>
    </Card>
  );
}
