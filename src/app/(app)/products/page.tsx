import type { Metadata } from "next";
import Link from "next/link";
import { toFeeModel } from "@/agents/handlers/pricing-model";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/fields";
import { EmptyState, KeyValue, Notice } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatPct, formatUsd } from "@/domain/format";
import { recommendProduct } from "@/domain/finance";
import { createCatalogProductAction, loadMockCatalogAction } from "@/server/actions/products";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Products" };

const TYPES = ["tee", "long_sleeve", "hoodie", "crewneck", "hat", "beanie", "tote", "mug", "poster", "sticker", "phone_case", "jacket", "shorts", "other"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ type?: string; provider?: string; calc?: string; price?: string; cac?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const ws = ctx.workspace.id;
  let q = ctx.db.from("provider_products").select("*, fulfillment_providers(key, name)").eq("workspace_id", ws).order("product_type").order("blank_name").limit(500);
  if (TYPES.includes(sp.type as (typeof TYPES)[number])) q = q.eq("product_type", sp.type as (typeof TYPES)[number]);
  const [catalog, providers, pricing, brandProducts] = await Promise.all([
    q,
    ctx.db.from("fulfillment_providers").select("id, key, name, adapter, status, notes").eq("workspace_id", ws).order("key"),
    ctx.db.from("pricing_models").select("*").eq("workspace_id", ws).is("brand_id", null).eq("is_default", true).maybeSingle(),
    ctx.db.from("brand_products").select("status, recommendation").eq("workspace_id", ws),
  ]);
  const rows = (catalog.data ?? []).filter((p) => !sp.provider || p.fulfillment_providers?.key === sp.provider);
  const model = toFeeModel(pricing.data);
  const calcProduct = sp.calc ? rows.find((p) => p.id === sp.calc) ?? (catalog.data ?? []).find((p) => p.id === sp.calc) : undefined;
  const price = sp.price ? Number(sp.price) : NaN;
  const cac = sp.cac ? Number(sp.cac) : model.targetCac;
  const calc =
    calcProduct && Number.isFinite(price) && price > 0
      ? recommendProduct(
          { blankCost: Number(calcProduct.blank_cost), decorationCost: Number(calcProduct.decoration_cost), fulfillmentFee: Number(calcProduct.fulfillment_fee), shippingCost: Number(calcProduct.shipping_estimate_domestic ?? 0) },
          price,
          model,
          { cac: Number.isFinite(cac) ? cac : undefined },
        )
      : null;
  const recCounts = new Map<string, number>();
  for (const p of brandProducts.data ?? []) if (p.recommendation) recCounts.set(p.recommendation, (recCounts.get(p.recommendation) ?? 0) + 1);
  const canEdit = ctx.role !== "viewer";

  return (
    <>
      <PageHeader
        title="Product catalog"
        description="Blanks available to the Product & Profit agent: manual entries, CSV imports and the demo mock catalog. Fulfill Engine plugs in through the same provider interface once access is granted."
        actions={
          canEdit ? (
            <>
              <ButtonLink href="/imports?kind=fulfillment_catalog">Import CSV</ButtonLink>
              <ActionForm action={loadMockCatalogAction} submitLabel="Load demo catalog" variant="secondary" inline />
              <Dialog trigger="Add product" title="Add catalog product">
                <ActionForm action={createCatalogProductAction} submitLabel="Add product" resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Provider SKU" htmlFor="sku">
                      <Input id="sku" name="provider_sku" required />
                    </Field>
                    <Field label="Blank name" htmlFor="bn">
                      <Input id="bn" name="blank_name" required />
                    </Field>
                    <Field label="Blank brand" htmlFor="bb">
                      <Input id="bb" name="blank_brand" />
                    </Field>
                    <Field label="Type" htmlFor="pt">
                      <Select id="pt" name="product_type" defaultValue="tee">
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Colors (comma separated)" htmlFor="col">
                      <Input id="col" name="available_colors" />
                    </Field>
                    <Field label="Sizes (comma separated)" htmlFor="siz">
                      <Input id="siz" name="available_sizes" />
                    </Field>
                    <Field label="Blank cost ($)" htmlFor="bc">
                      <Input id="bc" name="blank_cost" type="number" step="0.01" min="0" required />
                    </Field>
                    <Field label="Decoration method" htmlFor="dm">
                      <Input id="dm" name="decoration_method" defaultValue="dtg" required />
                    </Field>
                    <Field label="Decoration cost ($)" htmlFor="dc">
                      <Input id="dc" name="decoration_cost" type="number" step="0.01" min="0" defaultValue="0" />
                    </Field>
                    <Field label="Fulfillment fee ($)" htmlFor="ff">
                      <Input id="ff" name="fulfillment_fee" type="number" step="0.01" min="0" defaultValue="0" />
                    </Field>
                    <Field label="Domestic shipping estimate ($)" htmlFor="ship">
                      <Input id="ship" name="shipping_estimate_domestic" type="number" step="0.01" min="0" defaultValue="0" />
                    </Field>
                    <Field label="Production SLA (days)" htmlFor="sla">
                      <Input id="sla" name="production_sla_days" type="number" min="0" max="90" defaultValue="3" />
                    </Field>
                  </div>
                </ActionForm>
              </Dialog>
            </>
          ) : null
        }
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Fulfillment providers" actions={<Link href="/settings/providers" className="text-xs text-accent">Configure</Link>} />
          <CardBody>
            <ul className="space-y-2 text-xs">
              {(providers.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="text-ink">{p.name}</span>
                    <span className="block text-muted">{p.adapter === "fulfill_engine" && p.status !== "active" ? "Requires provider connection." : p.notes}</span>
                  </span>
                  <StatusChip status={p.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Unit economics calculator" description="Uses the workspace default pricing model (editable in Settings)." />
          <CardBody>
            <form className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end" aria-label="Economics calculator">
              <Field label="Catalog product" htmlFor="calc">
                <Select id="calc" name="calc" defaultValue={sp.calc ?? ""}>
                  <option value="">Choose…</option>
                  {(catalog.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.blank_name} ({p.provider_sku})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Retail price" htmlFor="price">
                <Input id="price" name="price" type="number" step="0.01" min="0.01" defaultValue={sp.price ?? "34.99"} />
              </Field>
              <Field label="CAC" htmlFor="cac">
                <Input id="cac" name="cac" type="number" step="0.01" min="0" defaultValue={sp.cac ?? String(model.targetCac)} />
              </Field>
              <button type="submit" className={buttonClass("primary")}>
                Calculate
              </button>
            </form>
            {calc ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={calc.recommendation} />
                  <span className="text-xs text-ink-2">{calc.reasons.join(" ")}</span>
                </div>
                <KeyValue
                  columns={3}
                  items={[
                    { label: "COGS (landed)", value: formatUsd(calc.economics.cogs) },
                    { label: "Gross profit / margin", value: `${formatUsd(calc.economics.grossProfit)} · ${formatPct(calc.economics.grossMargin)}` },
                    { label: "Transaction + platform fees", value: formatUsd(calc.economics.paymentProcessing + calc.economics.platformFees) },
                    { label: "Refund reserve", value: formatUsd(calc.economics.refundReserve) },
                    { label: "Contribution profit / margin", value: `${formatUsd(calc.economics.contributionProfit)} · ${formatPct(calc.economics.contributionMargin)}` },
                    { label: "Break-even CAC", value: formatUsd(calc.economics.breakEvenCac) },
                    { label: "Shipping subsidy", value: formatUsd(calc.economics.shippingSubsidy) },
                    { label: "Total contribution cost", value: formatUsd(calc.economics.totalContributionCost) },
                    { label: "2-item bundle break-even CAC", value: formatUsd(calc.bundleOfTwo.breakEvenCac) },
                  ]}
                />
              </div>
            ) : null}
            {recCounts.size ? <p className="mt-3 text-[11px] text-muted">Across brands: {[...recCounts.entries()].map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ")}</p> : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Catalog (${rows.length})`}
          actions={
            <form className="flex items-center gap-2" aria-label="Filter catalog">
              <label htmlFor="ptype" className="sr-only">
                Type
              </label>
              <Select id="ptype" name="type" defaultValue={sp.type ?? ""} className="h-8 w-36 text-xs">
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </Select>
              <label htmlFor="pprov" className="sr-only">
                Provider
              </label>
              <Select id="pprov" name="provider" defaultValue={sp.provider ?? ""} className="h-8 w-36 text-xs">
                <option value="">All providers</option>
                {(providers.data ?? []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Filter
              </button>
            </form>
          }
        />
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <TH>Blank</TH>
                <TH>Type</TH>
                <TH>Provider</TH>
                <TH>Method</TH>
                <TH className="text-right">Blank</TH>
                <TH className="text-right">Decoration</TH>
                <TH className="text-right">Fee</TH>
                <TH className="text-right">Ship (US)</TH>
                <TH className="text-right">SLA</TH>
                <TH>Colors / sizes</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <p className="text-ink">
                      {p.blank_name} <DemoBadge show={p.is_demo} />
                    </p>
                    <p className="font-mono text-[10px] text-muted">{p.provider_sku}</p>
                  </TD>
                  <TD className="text-xs">{p.product_type.replace("_", " ")}</TD>
                  <TD>
                    <Badge tone="muted">{p.fulfillment_providers?.name ?? "—"}</Badge>
                  </TD>
                  <TD className="text-xs">{p.decoration_method}</TD>
                  <TD className="text-right text-xs tabular">{formatUsd(Number(p.blank_cost))}</TD>
                  <TD className="text-right text-xs tabular">{formatUsd(Number(p.decoration_cost))}</TD>
                  <TD className="text-right text-xs tabular">{formatUsd(Number(p.fulfillment_fee))}</TD>
                  <TD className="text-right text-xs tabular">{formatUsd(p.shipping_estimate_domestic === null ? null : Number(p.shipping_estimate_domestic))}</TD>
                  <TD className="text-right text-xs tabular">{p.production_sla_days ?? "—"}d</TD>
                  <TD className="max-w-[220px] text-[11px] text-muted">
                    {p.available_colors.join(", ")}
                    <br />
                    {p.available_sizes.join(", ")}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <CardBody>
            <EmptyState title="The catalog is empty" description="Import a fulfillment catalog CSV, add products manually, or load the demo catalog." />
          </CardBody>
        )}
      </Card>
      {(catalog.data ?? []).some((p) => p.is_demo) ? (
        <div className="mt-3">
          <Notice tone="demo">Products marked DEMO use illustrative placeholder costs, not quotes from any provider.</Notice>
        </div>
      ) : null}
    </>
  );
}
