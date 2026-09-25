import { ActionForm } from "@/components/ui/action-form";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { Input } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatPct, formatUsd } from "@/domain/format";
import type { OrderEconomics } from "@/domain/finance";
import { repriceProductAction } from "@/server/actions/products";

export interface BrandProductView {
  id: string;
  code: string;
  title: string;
  status: string;
  retail_price: number;
  compare_at_price: number | null;
  recommendation: string | null;
  recommendation_reason: string | null;
  economics: unknown;
  is_demo: boolean;
  provider_products: { blank_name: string; product_type: string; provider_sku: string } | null;
  design_concepts: { code: string; title: string } | null;
}

export function ProductsTable({ products, canEdit }: { products: BrandProductView[]; canEdit: boolean }) {
  if (!products.length) return <EmptyState title="No products selected" description="Run the Product & Profit agent to pair approved designs with catalog blanks and compute unit economics." />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Product</TH>
          <TH>Blank</TH>
          <TH className="text-right">Price</TH>
          <TH className="text-right">COGS</TH>
          <TH className="text-right">Gross profit</TH>
          <TH className="text-right">Contribution</TH>
          <TH className="text-right">Break-even CAC</TH>
          <TH>Recommendation</TH>
          <TH>Status</TH>
          {canEdit ? <TH>Reprice</TH> : null}
        </tr>
      </THead>
      <TBody>
        {products.map((p) => {
          const e = (p.economics as { unit?: OrderEconomics; cac?: number; suggested_price?: number | null }) ?? {};
          const u = e.unit;
          return (
            <TR key={p.id}>
              <TD className="max-w-xs">
                <p className="text-ink">
                  <span className="font-mono text-[11px] text-muted">{p.code}</span> {p.title} <DemoBadge show={p.is_demo} />
                </p>
                {p.design_concepts ? <p className="text-[11px] text-muted">Design {p.design_concepts.code}</p> : null}
                {p.recommendation_reason ? <p className="mt-1 text-[11px] text-muted">{p.recommendation_reason}</p> : null}
              </TD>
              <TD className="text-xs text-ink-2">
                {p.provider_products?.blank_name}
                <p className="font-mono text-[10px] text-muted">{p.provider_products?.provider_sku}</p>
              </TD>
              <TD className="text-right tabular">
                {formatUsd(Number(p.retail_price))}
                {p.compare_at_price ? <p className="text-[11px] text-muted line-through">{formatUsd(Number(p.compare_at_price))}</p> : null}
              </TD>
              <TD className="text-right text-xs tabular" title={u ? `blank ${u.blankCost} + decoration ${u.decorationCost} + fees ${u.fulfillmentFees} + shipping subsidy ${u.shippingSubsidy}` : undefined}>
                {u ? formatUsd(u.cogs) : "—"}
              </TD>
              <TD className="text-right text-xs tabular">
                {u ? formatUsd(u.grossProfit) : "—"}
                <p className="text-muted">{u ? formatPct(u.grossMargin) : ""}</p>
              </TD>
              <TD className="text-right text-xs tabular">
                {u ? formatUsd(u.contributionProfit) : "—"}
                <p className="text-muted">{u ? `${formatPct(u.contributionMargin)} @ CAC ${formatUsd(e.cac ?? 0)}` : ""}</p>
              </TD>
              <TD className="text-right text-xs tabular">{u ? formatUsd(u.breakEvenCac) : "—"}</TD>
              <TD>
                <StatusChip status={p.recommendation} />
                {e.suggested_price ? <p className="mt-1 text-[11px] text-muted">Suggested {formatUsd(e.suggested_price)}</p> : null}
              </TD>
              <TD>
                <StatusChip status={p.status} />
              </TD>
              {canEdit ? (
                <TD>
                  <ActionForm action={repriceProductAction} submitLabel="Recompute" size="sm" variant="secondary" hidden={{ product_id: p.id }} inline>
                    <label className="sr-only" htmlFor={`price-${p.id}`}>
                      Retail price for {p.title}
                    </label>
                    <Input id={`price-${p.id}`} name="retail_price" type="number" step="0.01" min="0.01" defaultValue={Number(p.retail_price)} className="h-7 w-20 text-xs" />
                    <label className="sr-only" htmlFor={`cac-${p.id}`}>
                      CAC assumption
                    </label>
                    <Input id={`cac-${p.id}`} name="cac" type="number" step="0.01" min="0" placeholder="CAC" defaultValue={e.cac ?? ""} className="h-7 w-16 text-xs" />
                  </ActionForm>
                </TD>
              ) : null}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
