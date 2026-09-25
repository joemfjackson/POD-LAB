import { ColumnChart } from "@/components/charts/column-chart";
import { ActionForm } from "@/components/ui/action-form";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatPct, formatUsd } from "@/domain/format";
import { recomputeFinancialsAction } from "@/server/actions/finance";
import { getBrand } from "@/server/queries/brand";

const ROWS: Array<[string, string]> = [
  ["Revenue", "revenue"],
  ["Discounts", "discounts"],
  ["Net sales", "net_sales"],
  ["COGS (blank)", "cogs"],
  ["Decoration", "decoration_cost"],
  ["Fulfillment fees", "fulfillment_fees"],
  ["Shipping paid by customers", "shipping_paid"],
  ["Shipping subsidy", "shipping_subsidy"],
  ["Payment processing", "payment_processing"],
  ["Platform fees", "platform_fees"],
  ["Ad spend (attributed)", "ad_spend"],
  ["Refund reserve", "refund_reserve"],
  ["Refunds", "refunds"],
  ["Gross profit", "gross_profit"],
  ["Contribution profit", "contribution_profit"],
];

export default async function BrandFinancials({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const fin = await ctx.db.from("financial_metrics").select("*").eq("brand_id", id).order("metric_date");
  const rows = fin.data ?? [];
  const total = (k: string) => rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[k] ?? 0), 0);
  const canImport = ctx.role !== "viewer";
  return (
    <Card>
      <CardHeader
        title="Financial model"
        description="From imported orders. Gross profit and contribution profit exclude fixed overhead — they are not net income."
        actions={
          <>
            <DemoBadge show={rows.some((r) => r.is_demo)} />
            {canImport ? <ButtonLink href={`/imports?kind=orders&brand=${id}`} size="sm">Import orders</ButtonLink> : null}
            {canImport ? <ActionForm action={recomputeFinancialsAction} submitLabel="Rebuild from orders" size="sm" variant="secondary" hidden={{ brand_id: id }} inline /> : null}
          </>
        }
      />
      <CardBody>
        {rows.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted">Daily contribution profit</p>
              <ColumnChart data={rows.map((r) => ({ label: r.metric_date.slice(5), value: Math.max(0, Number(r.contribution_profit)) }))} ariaLabel="Daily contribution profit" valueFormat="usd_compact" />
            </div>
            <Table>
              <THead>
                <tr>
                  <TH>Line</TH>
                  <TH className="text-right">All time</TH>
                </tr>
              </THead>
              <TBody>
                {ROWS.map(([label, key]) => (
                  <TR key={key}>
                    <TD className={key.endsWith("profit") ? "font-semibold text-ink" : "text-ink-2"}>{label}</TD>
                    <TD className="text-right tabular">{formatUsd(total(key))}</TD>
                  </TR>
                ))}
                <TR>
                  <TD className="text-ink-2">Gross margin / contribution margin</TD>
                  <TD className="text-right tabular">
                    {formatPct(total("net_sales") ? total("gross_profit") / total("net_sales") : null)} / {formatPct(total("net_sales") ? total("contribution_profit") / total("net_sales") : null)}
                  </TD>
                </TR>
              </TBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="No financial data" description="Import orders as CSV, then rebuild the daily financial model." />
        )}
      </CardBody>
    </Card>
  );
}
