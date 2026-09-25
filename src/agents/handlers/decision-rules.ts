import { DEFAULT_DECISION_RULES, type DecisionRules, type RawMetrics } from "@/domain/decision-engine";
import type { Tables } from "@/lib/supabase/database.types";

export function toDecisionRules(row: Tables<"decision_rule_sets"> | null): DecisionRules {
  if (!row) return DEFAULT_DECISION_RULES;
  return {
    minSessions: row.min_sessions,
    minImpressions: row.min_impressions,
    minPurchases: row.min_purchases,
    minAdSpendUsd: Number(row.min_ad_spend_usd),
    minDaysRunning: row.min_days_running,
    killMaxConversionRate: Number(row.kill_max_conversion_rate),
    killMaxCtr: Number(row.kill_max_ctr),
    killMaxContributionMargin: Number(row.kill_max_contribution_margin),
    scaleMinRoas: Number(row.scale_min_roas),
    scaleMinContributionMargin: Number(row.scale_min_contribution_margin),
    scaleMinConversionRate: Number(row.scale_min_conversion_rate),
    cloneMinCtr: Number(row.clone_min_ctr),
    iterateMinCtr: Number(row.iterate_min_ctr),
    minLiftForWinner: Number(row.min_lift_for_winner),
  };
}

export function metricRowToRaw(r: Tables<"experiment_metrics">): RawMetrics {
  return {
    impressions: r.impressions,
    clicks: r.clicks,
    sessions: r.sessions,
    productViews: r.product_views,
    addToCarts: r.add_to_carts,
    checkouts: r.checkouts,
    purchases: r.purchases,
    grossRevenue: Number(r.gross_revenue),
    discounts: Number(r.discounts),
    refunds: Number(r.refunds),
    cogs: Number(r.cogs),
    fulfillmentCost: Number(r.fulfillment_cost),
    shippingSubsidy: Number(r.shipping_subsidy),
    adSpend: Number(r.ad_spend),
    repeatBuyers: r.repeat_buyers,
  };
}
