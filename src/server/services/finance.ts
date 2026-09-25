import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateDaily, type OrderRow } from "@/domain/financial-model";
import type { Database } from "@/lib/supabase/database.types";
import { UserFacingError } from "./errors";

/** Rebuilds daily financial_metrics for a brand from its imported orders. */
export async function recomputeBrandFinancials(db: SupabaseClient<Database>, workspaceId: string, brandId: string): Promise<number> {
  const orders = await db.from("orders_import").select("*").eq("brand_id", brandId).limit(50000);
  if (orders.error) throw new UserFacingError(orders.error.message);
  const pricing = await db.from("pricing_models").select("refund_reserve_pct, brand_id").eq("workspace_id", workspaceId).or(`brand_id.eq.${brandId},and(brand_id.is.null,is_default.eq.true)`);
  const reserve = Number((pricing.data ?? []).find((p) => p.brand_id === brandId)?.refund_reserve_pct ?? pricing.data?.[0]?.refund_reserve_pct ?? 0.03);
  const rows: OrderRow[] = (orders.data ?? []).map((o) => ({
    orderDate: o.order_date,
    quantity: o.quantity,
    revenue: Number(o.revenue),
    discount: Number(o.discount),
    shippingPaid: Number(o.shipping_paid),
    cogs: Number(o.cogs),
    decorationCost: Number(o.decoration_cost),
    fulfillmentFee: Number(o.fulfillment_fee),
    shippingCost: Number(o.shipping_cost),
    paymentProcessing: Number(o.payment_processing),
    platformFee: Number(o.platform_fee),
    adAttribution: Number(o.ad_attribution),
    refunds: Number(o.refunds),
  }));
  const isDemo = (orders.data ?? []).some((o) => o.is_demo);
  const daily = aggregateDaily(rows, reserve);
  const del = await db.from("financial_metrics").delete().eq("brand_id", brandId).eq("source", "orders_import");
  if (del.error) throw new UserFacingError(del.error.message);
  if (!daily.length) return 0;
  const ins = await db.from("financial_metrics").insert(
    daily.map((d) => ({
      workspace_id: workspaceId,
      brand_id: brandId,
      metric_date: d.date,
      orders: d.orders,
      units: d.units,
      revenue: d.revenue,
      discounts: d.discounts,
      net_sales: d.netSales,
      cogs: d.cogs,
      decoration_cost: d.decorationCost,
      fulfillment_fees: d.fulfillmentFees,
      shipping_paid: d.shippingPaid,
      shipping_cost: d.shippingCost,
      shipping_subsidy: d.shippingSubsidy,
      payment_processing: d.paymentProcessing,
      platform_fees: d.platformFees,
      ad_spend: d.adSpend,
      refund_reserve: d.refundReserve,
      refunds: d.refunds,
      gross_profit: d.grossProfit,
      contribution_profit: d.contributionProfit,
      source: "orders_import" as const,
      is_demo: isDemo,
    })),
  );
  if (ins.error) throw new UserFacingError(ins.error.message);
  return daily.length;
}
