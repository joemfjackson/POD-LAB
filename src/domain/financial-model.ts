/**
 * Order-level financial model and period aggregation.
 *
 *   net sales            = revenue − discount
 *   shipping subsidy     = max(0, shipping cost − shipping paid by customer)
 *   COGS (landed)        = blank/product COGS + decoration + fulfillment fees + shipping subsidy
 *   gross profit         = net sales − refunds − COGS (landed)
 *   refund reserve       = net sales × reserve % for orders with no recorded refund
 *   contribution profit  = gross profit − payment processing − platform fees − refund reserve − attributed ads
 *
 * Neither figure is net income: fixed overhead is not modelled.
 */

export interface OrderRow {
  orderDate: string;
  quantity: number;
  revenue: number;
  discount: number;
  shippingPaid: number;
  cogs: number;
  decorationCost: number;
  fulfillmentFee: number;
  shippingCost: number;
  paymentProcessing: number;
  platformFee: number;
  adAttribution: number;
  refunds: number;
}

export interface FinancialLine {
  orders: number;
  units: number;
  revenue: number;
  discounts: number;
  netSales: number;
  cogs: number;
  decorationCost: number;
  fulfillmentFees: number;
  shippingPaid: number;
  shippingCost: number;
  shippingSubsidy: number;
  paymentProcessing: number;
  platformFees: number;
  adSpend: number;
  refundReserve: number;
  refunds: number;
  grossProfit: number;
  contributionProfit: number;
}

export const EMPTY_LINE: FinancialLine = {
  orders: 0,
  units: 0,
  revenue: 0,
  discounts: 0,
  netSales: 0,
  cogs: 0,
  decorationCost: 0,
  fulfillmentFees: 0,
  shippingPaid: 0,
  shippingCost: 0,
  shippingSubsidy: 0,
  paymentProcessing: 0,
  platformFees: 0,
  adSpend: 0,
  refundReserve: 0,
  refunds: 0,
  grossProfit: 0,
  contributionProfit: 0,
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function orderFinancials(o: OrderRow, refundReservePct: number): FinancialLine {
  const netSales = o.revenue - o.discount;
  const shippingSubsidy = Math.max(0, o.shippingCost - o.shippingPaid);
  const landedCogs = o.cogs + o.decorationCost + o.fulfillmentFee + shippingSubsidy;
  const refundReserve = o.refunds > 0 ? 0 : netSales * refundReservePct;
  const grossProfit = netSales - o.refunds - landedCogs;
  const contributionProfit = grossProfit - o.paymentProcessing - o.platformFee - refundReserve - o.adAttribution;
  return {
    orders: 1,
    units: o.quantity,
    revenue: r2(o.revenue),
    discounts: r2(o.discount),
    netSales: r2(netSales),
    cogs: r2(o.cogs),
    decorationCost: r2(o.decorationCost),
    fulfillmentFees: r2(o.fulfillmentFee),
    shippingPaid: r2(o.shippingPaid),
    shippingCost: r2(o.shippingCost),
    shippingSubsidy: r2(shippingSubsidy),
    paymentProcessing: r2(o.paymentProcessing),
    platformFees: r2(o.platformFee),
    adSpend: r2(o.adAttribution),
    refundReserve: r2(refundReserve),
    refunds: r2(o.refunds),
    grossProfit: r2(grossProfit),
    contributionProfit: r2(contributionProfit),
  };
}

export function addLines(a: FinancialLine, b: FinancialLine): FinancialLine {
  const out = { ...EMPTY_LINE };
  for (const k of Object.keys(out) as (keyof FinancialLine)[]) out[k] = r2(a[k] + b[k]);
  return out;
}

export function sumLines(lines: readonly FinancialLine[]): FinancialLine {
  return lines.reduce(addLines, { ...EMPTY_LINE });
}

/** Groups orders by date and returns one aggregated line per day (sorted). */
export function aggregateDaily(
  orders: readonly OrderRow[],
  refundReservePct: number,
): Array<{ date: string } & FinancialLine> {
  const byDate = new Map<string, FinancialLine>();
  for (const o of orders) {
    const line = orderFinancials(o, refundReservePct);
    byDate.set(o.orderDate, addLines(byDate.get(o.orderDate) ?? { ...EMPTY_LINE }, line));
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, line]) => ({ date, ...line }));
}

export interface FinancialRatios {
  grossMargin: number | null;
  contributionMargin: number | null;
  aov: number | null;
  roas: number | null;
  cac: number | null;
}

export function ratios(line: FinancialLine): FinancialRatios {
  return {
    grossMargin: line.netSales > 0 ? line.grossProfit / line.netSales : null,
    contributionMargin: line.netSales > 0 ? line.contributionProfit / line.netSales : null,
    aov: line.orders > 0 ? line.netSales / line.orders : null,
    roas: line.adSpend > 0 ? line.netSales / line.adSpend : null,
    cac: line.adSpend > 0 && line.orders > 0 ? line.adSpend / line.orders : null,
  };
}

export type ReportRange = "7d" | "30d" | "90d" | "all";

export function rangeStart(range: ReportRange, now: Date = new Date()): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}
