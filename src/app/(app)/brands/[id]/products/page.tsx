import { ProductsTable, type BrandProductView } from "@/components/shared/products-table";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { formatUsd } from "@/domain/format";
import { requestAssortmentApprovalAction } from "@/server/actions/products";
import { getBrand } from "@/server/queries/brand";

export default async function BrandProducts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const [products, bundles, gate] = await Promise.all([
    ctx.db
      .from("brand_products")
      .select("id, code, title, status, retail_price, compare_at_price, recommendation, recommendation_reason, economics, is_demo, provider_products(blank_name, product_type, provider_sku), design_concepts(code, title)")
      .eq("brand_id", id)
      .order("created_at"),
    ctx.db.from("bundles").select("id, name, description, bundle_price, status, bundle_items(brand_products(title, retail_price))").eq("brand_id", id),
    ctx.db.from("approval_gates").select("id").eq("brand_id", id).eq("gate_type", "product_assortment").eq("status", "pending").maybeSingle(),
  ]);
  const canEdit = ctx.role !== "viewer";
  const hasCandidates = (products.data ?? []).some((p) => p.status === "candidate");
  return (
    <div className="space-y-5">
      <Notice tone="info" title="Economics">
        Computed deterministically: COGS = blank + decoration + fulfillment fee + shipping subsidy; contribution subtracts payment processing, platform fees, refund reserve and CAC. Gross and contribution profit are not net income.
      </Notice>
      <Card>
        <CardHeader
          title="Assortment"
          actions={
            canEdit && hasCandidates && !gate.data ? <ActionForm action={requestAssortmentApprovalAction} submitLabel="Request assortment approval" size="sm" hidden={{ brand_id: id }} inline /> : gate.data ? <a href={`/approvals/${gate.data.id}`} className="text-xs text-accent">Assortment approval pending →</a> : null
          }
        />
        <ProductsTable products={(products.data ?? []) as BrandProductView[]} canEdit={canEdit} />
      </Card>
      <Card>
        <CardHeader title="Bundles" />
        <CardBody>
          {bundles.data?.length ? (
            <ul className="space-y-2 text-sm">
              {bundles.data.map((b) => {
                const list = b.bundle_items.reduce((s, i) => s + Number(i.brand_products?.retail_price ?? 0), 0);
                return (
                  <li key={b.id}>
                    <span className="text-ink">{b.name}</span> — {formatUsd(Number(b.bundle_price))} <span className="text-xs text-muted">(list {formatUsd(list)}; {b.bundle_items.map((i) => i.brand_products?.title).join(" + ")})</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted">No bundles yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
