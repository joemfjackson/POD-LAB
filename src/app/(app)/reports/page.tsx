import type { Metadata } from "next";
import Link from "next/link";
import { AGENT_DEFINITIONS } from "@/agents/registry";
import { LineChart } from "@/components/charts/line-chart";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deriveMetrics, sumMetrics } from "@/domain/decision-engine";
import { formatInt, formatPct, formatUsd } from "@/domain/format";
import { rangeStart, type ReportRange } from "@/domain/financial-model";
import { STAGE_LABELS, type BrandStage } from "@/domain/lifecycle";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Reports" };

const RANGES: Array<{ key: ReportRange; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range = (RANGES.find((r) => r.key === sp.range)?.key ?? "30d") as ReportRange;
  const since = rangeStart(range);
  const ctx = await getContext();
  const ws = ctx.workspace.id;
  const sinceTs = since ? `${since}T00:00:00Z` : "1970-01-01T00:00:00Z";

  let finQ = ctx.db.from("financial_metrics").select("brand_id, metric_date, revenue, net_sales, gross_profit, contribution_profit, orders, ad_spend, is_demo").eq("workspace_id", ws).order("metric_date");
  if (since) finQ = finQ.gte("metric_date", since);
  let ordQ = ctx.db.from("orders_import").select("brand_product_id, sku, product_title, quantity, revenue, discount").eq("workspace_id", ws);
  if (since) ordQ = ordQ.gte("order_date", since);
  let metQ = ctx.db.from("experiment_metrics").select("experiment_id, impressions, clicks, sessions, product_views, add_to_carts, checkouts, purchases, gross_revenue, discounts, refunds, cogs, fulfillment_cost, shipping_subsidy, ad_spend, repeat_buyers, is_demo").eq("workspace_id", ws);
  if (since) metQ = metQ.gte("metric_date", since);

  const [brands, fin, orders, metrics, experiments, runs, opps, missions, products] = await Promise.all([
    ctx.db.from("brands").select("id, code, working_title, official_name, stage").eq("workspace_id", ws).order("code"),
    finQ,
    ordQ,
    metQ,
    ctx.db.from("experiments").select("id, brand_id, status, decision, override_decision").eq("workspace_id", ws),
    ctx.db.from("agent_runs").select("agent_key, status, duration_ms, estimated_cost_usd, input_tokens, output_tokens").eq("workspace_id", ws).gte("started_at", sinceTs),
    ctx.db.from("opportunities").select("status, confidence, research_mode").eq("workspace_id", ws),
    ctx.db.from("research_missions").select("id", { count: "exact", head: true }).eq("workspace_id", ws).gte("created_at", sinceTs),
    ctx.db.from("brand_products").select("id, code, title, brand_id, retail_price, recommendation, status, economics, design_id, design_concepts(code, title)").eq("workspace_id", ws),
  ]);

  const f = fin.data ?? [];
  const sum = (rows: typeof f, k: "revenue" | "net_sales" | "gross_profit" | "contribution_profit" | "orders" | "ad_spend") => rows.reduce((s, r) => s + Number(r[k]), 0);
  const demoFin = f.some((r) => r.is_demo);
  const dates = [...new Set(f.map((r) => r.metric_date))].sort();
  const byDate = (k: "revenue" | "gross_profit" | "contribution_profit") => dates.map((d) => f.filter((r) => r.metric_date === d).reduce((s, r) => s + Number(r[k]), 0));
  const traffic = deriveMetrics(
    sumMetrics(
      (metrics.data ?? []).map((m) => ({
        impressions: m.impressions, clicks: m.clicks, sessions: m.sessions, productViews: m.product_views, addToCarts: m.add_to_carts, checkouts: m.checkouts, purchases: m.purchases,
        grossRevenue: Number(m.gross_revenue), discounts: Number(m.discounts), refunds: Number(m.refunds), cogs: Number(m.cogs), fulfillmentCost: Number(m.fulfillment_cost), shippingSubsidy: Number(m.shipping_subsidy), adSpend: Number(m.ad_spend), repeatBuyers: m.repeat_buyers,
      })),
    ),
  );
  const stageCounts = new Map<string, number>();
  for (const b of brands.data ?? []) stageCounts.set(b.stage, (stageCounts.get(b.stage) ?? 0) + 1);
  const productSales = new Map<string, { units: number; revenue: number }>();
  for (const o of orders.data ?? []) {
    if (!o.brand_product_id) continue;
    const cur = productSales.get(o.brand_product_id) ?? { units: 0, revenue: 0 };
    productSales.set(o.brand_product_id, { units: cur.units + o.quantity, revenue: cur.revenue + Number(o.revenue) - Number(o.discount) });
  }
  const decisionCounts = new Map<string, number>();
  for (const e of experiments.data ?? []) {
    const d = e.override_decision ?? e.decision ?? "not analysed";
    decisionCounts.set(d, (decisionCounts.get(d) ?? 0) + 1);
  }
  const oppCounts = new Map<string, number>();
  for (const o of opps.data ?? []) oppCounts.set(o.status, (oppCounts.get(o.status) ?? 0) + 1);

  return (
    <>
      <PageHeader title="Reports" description="Portfolio, brand, product, design, traffic, conversion, financial, experiment, agent and research-pipeline reporting." />
      <nav aria-label="Date range" className="mb-5 flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <Link key={r.key} href={`/reports?range=${r.key}`} aria-current={r.key === range ? "page" : undefined} className={cn(buttonClass(r.key === range ? "primary" : "secondary", "sm"))}>
            {r.label}
          </Link>
        ))}
      </nav>

      <section aria-label="Portfolio overview" className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Active brands" value={formatInt((brands.data ?? []).filter((b) => !["killed", "archived"].includes(b.stage)).length)} />
        <StatTile label="Revenue" value={formatUsd(sum(f, "revenue"), { compact: true })} />
        <StatTile label="Gross profit" value={formatUsd(sum(f, "gross_profit"), { compact: true })} />
        <StatTile label="Contribution profit" value={formatUsd(sum(f, "contribution_profit"), { compact: true })} />
        <StatTile label="Orders" value={formatInt(sum(f, "orders"))} />
        <StatTile label="Sessions (experiments)" value={formatInt(traffic.sessions)} />
        <StatTile label="Conversion" value={formatPct(traffic.conversionRate, 2)} />
        <StatTile label="Agent cost" value={formatUsd((runs.data ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd), 0))} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Financials" description="Gross and contribution profit exclude fixed overhead (not net income)." actions={<DemoBadge show={demoFin} />} />
          <CardBody>
            {dates.length ? (
              <LineChart
                labels={dates.map((d) => d.slice(5))}
                series={[
                  { name: "Revenue", values: byDate("revenue") },
                  { name: "Gross profit", values: byDate("gross_profit") },
                  { name: "Contribution profit", values: byDate("contribution_profit") },
                ]}
                ariaLabel="Revenue, gross profit and contribution profit by day"
                valueFormat="usd_compact"
              />
            ) : (
              <EmptyState title="No financial data in range" description="Import orders to populate financial reporting." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Traffic & conversion" description="Aggregated from experiment metrics in range." actions={<DemoBadge show={(metrics.data ?? []).some((m) => m.is_demo)} />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {[
                ["Impressions", formatInt(traffic.impressions)],
                ["Clicks", formatInt(traffic.clicks)],
                ["CTR", formatPct(traffic.ctr, 2)],
                ["CPC", formatUsd(traffic.cpc)],
                ["Sessions", formatInt(traffic.sessions)],
                ["Add-to-cart rate", formatPct(traffic.addToCartRate)],
                ["Checkout rate", formatPct(traffic.checkoutRate)],
                ["Purchases", formatInt(traffic.purchases)],
                ["Conversion rate", formatPct(traffic.conversionRate, 2)],
                ["AOV", formatUsd(traffic.aov)],
                ["CAC", formatUsd(traffic.cac)],
                ["ROAS", traffic.roas === null ? "—" : `${traffic.roas.toFixed(2)}×`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Brand performance" />
          <Table>
            <THead>
              <tr>
                <TH>Brand</TH>
                <TH>Stage</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">Gross</TH>
                <TH className="text-right">Contribution</TH>
                <TH className="text-right">CM%</TH>
              </tr>
            </THead>
            <TBody>
              {(brands.data ?? []).map((b) => {
                const rows = f.filter((r) => r.brand_id === b.id);
                const ns = sum(rows, "net_sales");
                return (
                  <TR key={b.id}>
                    <TD>
                      <Link href={`/brands/${b.id}/financials`} className="hover:text-accent">
                        <span className="font-mono text-xs text-muted">{b.code}</span> {b.official_name ?? b.working_title}
                      </Link>
                    </TD>
                    <TD>
                      <StatusChip status={b.stage} label={STAGE_LABELS[b.stage as BrandStage]} />
                    </TD>
                    <TD className="text-right text-xs tabular">{formatUsd(sum(rows, "revenue"))}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(sum(rows, "gross_profit"))}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(sum(rows, "contribution_profit"))}</TD>
                    <TD className="text-right text-xs tabular">{formatPct(ns ? sum(rows, "contribution_profit") / ns : null)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Product performance" description="Modelled unit economics and imported sales in range." />
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH>Design</TH>
                <TH className="text-right">Price</TH>
                <TH className="text-right">Unit contribution</TH>
                <TH className="text-right">Units sold</TH>
                <TH className="text-right">Net sales</TH>
                <TH>Rec.</TH>
              </tr>
            </THead>
            <TBody>
              {(products.data ?? []).slice(0, 40).map((p) => {
                const unit = (p.economics as { unit?: { contributionProfit: number } }).unit;
                const sales = productSales.get(p.id);
                return (
                  <TR key={p.id}>
                    <TD className="text-xs">
                      <span className="font-mono text-muted">{p.code}</span> {p.title}
                    </TD>
                    <TD className="font-mono text-xs text-muted">{p.design_concepts?.code ?? "—"}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(Number(p.retail_price))}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(unit?.contributionProfit ?? null)}</TD>
                    <TD className="text-right text-xs tabular">{formatInt(sales?.units ?? 0)}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(sales?.revenue ?? 0)}</TD>
                    <TD>
                      <StatusChip status={p.recommendation} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {!products.data?.length ? <CardBody><p className="text-xs text-muted">No products yet.</p></CardBody> : null}
        </Card>

        <Card>
          <CardHeader title="Design performance" description="Products and sales attributed to each design." />
          <CardBody>
            <ul className="space-y-1.5 text-xs">
              {[...new Map((products.data ?? []).filter((p) => p.design_concepts).map((p) => [p.design_id!, p])).values()].slice(0, 20).map((p) => {
                const items = (products.data ?? []).filter((x) => x.design_id === p.design_id);
                const revenue = items.reduce((s, x) => s + (productSales.get(x.id)?.revenue ?? 0), 0);
                return (
                  <li key={p.design_id} className="flex justify-between gap-2">
                    <Link href={`/design-studio/${p.design_id}`} className="truncate text-ink-2 hover:text-accent">
                      <span className="font-mono text-muted">{p.design_concepts?.code}</span> {p.design_concepts?.title}
                    </Link>
                    <span className="shrink-0 text-muted tabular">
                      {items.length} product(s) · {formatUsd(revenue)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Experiments" />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {[...decisionCounts.entries()].map(([k, v]) => (
                <li key={k}>
                  <StatusChip status={k === "not analysed" ? "unknown" : k} label={`${k.replace("_", " ")}: ${v}`} />
                </li>
              ))}
              {!decisionCounts.size ? <li className="text-xs text-muted">No experiments.</li> : null}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Agent performance" description="Runs in range." />
          <Table>
            <THead>
              <tr>
                <TH>Agent</TH>
                <TH className="text-right">Runs</TH>
                <TH className="text-right">Success</TH>
                <TH className="text-right">Tokens</TH>
                <TH className="text-right">Cost</TH>
              </tr>
            </THead>
            <TBody>
              {AGENT_DEFINITIONS.map((a) => {
                const r = (runs.data ?? []).filter((x) => x.agent_key === a.key);
                const ok = r.filter((x) => x.status === "succeeded").length;
                return (
                  <TR key={a.key}>
                    <TD className="text-xs">{a.name}</TD>
                    <TD className="text-right text-xs tabular">{r.length}</TD>
                    <TD className="text-right text-xs tabular">{formatPct(r.length ? ok / r.length : null, 0)}</TD>
                    <TD className="text-right text-xs tabular">{formatInt(r.reduce((s, x) => s + (x.input_tokens ?? 0) + (x.output_tokens ?? 0), 0))}</TD>
                    <TD className="text-right text-xs tabular">{formatUsd(r.reduce((s, x) => s + Number(x.estimated_cost_usd), 0))}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Research pipeline" description={`${missions.count ?? 0} mission(s) in range`} />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {["inbox", "researching", "candidate", "approved", "rejected", "archived"].map((s) => (
                <li key={s}>
                  <StatusChip status={s} label={`${s}: ${oppCounts.get(s) ?? 0}`} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Live-sourced research: {(opps.data ?? []).filter((o) => o.research_mode === "live").length} · model-only: {(opps.data ?? []).filter((o) => o.research_mode === "model_only").length} · demo: {(opps.data ?? []).filter((o) => o.research_mode === "demo").length}
            </p>
            <p className="mt-1 text-xs text-muted">
              Brands by stage: {[...stageCounts.entries()].map(([k, v]) => `${STAGE_LABELS[k as BrandStage]} ${v}`).join(" · ") || "none"}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
