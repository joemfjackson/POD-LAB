import { DEFAULT_FEE_MODEL, type CostInputs, type FeeModel } from "@/domain/finance";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

export function toFeeModel(row: Tables<"pricing_models"> | null): FeeModel {
  if (!row) return DEFAULT_FEE_MODEL;
  const tiers = Array.isArray(row.quantity_discounts)
    ? (row.quantity_discounts as Array<{ minQuantity?: unknown; percentOff?: unknown }>)
        .map((t) => ({ minQuantity: Number(t.minQuantity), percentOff: Number(t.percentOff) }))
        .filter((t) => Number.isFinite(t.minQuantity) && Number.isFinite(t.percentOff))
    : [];
  return {
    paymentProcessingPct: Number(row.payment_processing_pct),
    paymentProcessingFixed: Number(row.payment_processing_fixed),
    platformFeePct: Number(row.platform_fee_pct),
    shippingCharged: Number(row.shipping_charged),
    freeShippingThreshold: row.free_shipping_threshold === null ? null : Number(row.free_shipping_threshold),
    refundReservePct: Number(row.refund_reserve_pct),
    targetCac: Number(row.target_cac),
    targetContributionMargin: Number(row.target_contribution_margin),
    minGrossMargin: Number(row.min_gross_margin),
    quantityDiscounts: tiers,
  };
}

/** Brand-specific pricing model if present, otherwise the workspace default. */
export async function loadPricingModel(db: AdminClient, workspaceId: string, brandId: string | null) {
  if (brandId) {
    const brandModel = await db.from("pricing_models").select("*").eq("workspace_id", workspaceId).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (brandModel.data) return brandModel.data;
  }
  const def = await db.from("pricing_models").select("*").eq("workspace_id", workspaceId).is("brand_id", null).eq("is_default", true).maybeSingle();
  return def.data;
}

export function costsOf(p: Pick<Tables<"provider_products">, "blank_cost" | "decoration_cost" | "fulfillment_fee" | "shipping_estimate_domestic">): CostInputs {
  return {
    blankCost: Number(p.blank_cost),
    decorationCost: Number(p.decoration_cost),
    fulfillmentFee: Number(p.fulfillment_fee),
    shippingCost: Number(p.shipping_estimate_domestic ?? 0),
  };
}
