import { ProductsTable, type BrandProductView } from "@/components/shared/products-table";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { formatUsd } from "@/domain/format";
import { Field, Input, Select } from "@/components/ui/fields";
import { attachProductAction, requestAssortmentApprovalAction } from "@/server/actions/products";
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
  const [catalog, designs] = await Promise.all([
    ctx.db.from("provider_products").select("id, blank_name, provider_sku").eq("workspace_id", ctx.workspace.id).eq("active", true).order("blank_name"),
    ctx.db.from("design_concepts").select("id, code, title").eq("brand_id", id).in("status", ["approved", "production_ready"]).order("code"),
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
      {canEdit ? (
        <Card>
          <CardHeader title="Add a product manually" description="Economics and the recommendation are computed with the same rules the agent uses." />
          <CardBody>
            {catalog.data?.length ? (
              <ActionForm action={attachProductAction} submitLabel="Add product" hidden={{ brand_id: id }} resetOnSuccess>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Catalog blank" htmlFor="att-pp">
                    <Select id="att-pp" name="provider_product_id">
                      {catalog.data.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.blank_name} ({c.provider_sku})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Design (approved)" htmlFor="att-design">
                    <Select id="att-design" name="design_id" defaultValue="">
                      <option value="">None</option>
                      {(designs.data ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} {d.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Title" htmlFor="att-title">
                    <Input id="att-title" name="title" required minLength={2} />
                  </Field>
                  <Field label="Retail price ($)" htmlFor="att-price">
                    <Input id="att-price" name="retail_price" type="number" step="0.01" min="0.01" defaultValue="34.99" required />
                  </Field>
                </div>
              </ActionForm>
            ) : (
              <p className="text-xs text-muted">The catalog is empty — import or add blanks under Products first.</p>
            )}
          </CardBody>
        </Card>
      ) : null}
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
